"""
Ollama Admin GPU Agent — Lightweight sidecar that exposes GPU metrics via HTTP.

Supports NVIDIA GPUs (nvidia-smi), AMD GPUs (rocm-smi), and Apple Silicon (Metal).
Deploy alongside each Ollama server to enable GPU monitoring in Ollama Admin.
"""

import os
import platform
import plistlib
import shutil
import subprocess
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="Ollama Admin GPU Agent", version="1.1.0")

MIB_TO_BYTES = 1024 * 1024
GIB_TO_BYTES = 1024 * 1024 * 1024
GPU_BACKEND = os.getenv("GPU_BACKEND", "auto")


def detect_backend() -> str | None:
    """Detect available GPU backend: nvidia, amd, apple, or None."""
    if GPU_BACKEND in ("nvidia", "amd", "apple"):
        return GPU_BACKEND
    if shutil.which("nvidia-smi"):
        return "nvidia"
    if shutil.which("rocm-smi"):
        return "amd"
    if platform.system() == "Darwin" and shutil.which("system_profiler"):
        return "apple"
    return None


def query_nvidia() -> list[dict]:
    """Query NVIDIA GPUs using nvidia-smi."""
    result = subprocess.run(
        [
            "nvidia-smi",
            "--query-gpu=name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu",
            "--format=csv,noheader,nounits",
        ],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"nvidia-smi failed: {result.stderr.strip()}")

    gpus = []
    for line in result.stdout.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) != 6:
            continue
        gpus.append(
            {
                "name": parts[0],
                "memoryTotal": int(float(parts[1])) * MIB_TO_BYTES,
                "memoryUsed": int(float(parts[2])) * MIB_TO_BYTES,
                "memoryFree": int(float(parts[3])) * MIB_TO_BYTES,
                "temperature": int(float(parts[4])),
                "utilization": int(float(parts[5])),
            }
        )
    return gpus


def query_amd() -> list[dict]:
    """Query AMD GPUs using rocm-smi."""
    result = subprocess.run(
        [
            "rocm-smi",
            "--showid",
            "--showtemp",
            "--showuse",
            "--showmeminfo",
            "vram",
            "--csv",
        ],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"rocm-smi failed: {result.stderr.strip()}")

    gpus = []
    lines = result.stdout.strip().splitlines()
    if len(lines) < 2:
        return gpus

    headers = [h.strip().lower() for h in lines[0].split(",")]

    for line in lines[1:]:
        parts = [p.strip() for p in line.split(",")]
        if len(parts) != len(headers):
            continue

        row = dict(zip(headers, parts))

        name = row.get("card series", row.get("device name", f"AMD GPU"))
        temp = float(row.get("temperature (sensor edge) (c)", row.get("temperature", "0")))
        usage = float(row.get("gpu use (%)", row.get("gpu usage", "0")))
        vram_total = int(float(row.get("vram total memory (b)", "0")))
        vram_used = int(float(row.get("vram total used memory (b)", "0")))

        if vram_total == 0:
            total_mib = float(row.get("vram total", "0"))
            used_mib = float(row.get("vram used", "0"))
            vram_total = int(total_mib) * MIB_TO_BYTES
            vram_used = int(used_mib) * MIB_TO_BYTES

        gpus.append(
            {
                "name": name,
                "memoryTotal": vram_total,
                "memoryUsed": vram_used,
                "memoryFree": vram_total - vram_used,
                "temperature": int(temp),
                "utilization": int(usage),
            }
        )
    return gpus


def query_apple() -> list[dict]:
    """Query Apple Silicon GPU using system_profiler."""
    result = subprocess.run(
        ["system_profiler", "SPDisplaysDataType", "-xml"],
        capture_output=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"system_profiler failed: {result.stderr.decode().strip()}")

    gpus = []
    try:
        plist = plistlib.loads(result.stdout)
        displays = plist[0].get("_items", [])

        for display in displays:
            name = display.get("sppci_model", "Apple GPU")

            # Get VRAM - Apple reports in various formats
            vram_str = display.get("spdisplays_vram", display.get("sppci_vram", "0"))
            if isinstance(vram_str, str):
                # Parse strings like "16 GB" or "8192 MB"
                vram_str = vram_str.upper().replace(" ", "")
                if "GB" in vram_str:
                    vram_total = int(float(vram_str.replace("GB", ""))) * GIB_TO_BYTES
                elif "MB" in vram_str:
                    vram_total = int(float(vram_str.replace("MB", ""))) * MIB_TO_BYTES
                else:
                    vram_total = int(float(vram_str)) if vram_str.isdigit() else 0
            else:
                vram_total = int(vram_str) if vram_str else 0

            # For unified memory Macs, use total system memory as GPU memory
            # since Metal can use all unified memory
            if vram_total == 0:
                mem_result = subprocess.run(
                    ["sysctl", "-n", "hw.memsize"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if mem_result.returncode == 0:
                    vram_total = int(mem_result.stdout.strip())

            # Apple Silicon doesn't expose per-GPU utilization easily
            # We use vm_stat to estimate memory pressure
            vram_used = 0
            utilization = 0
            try:
                vm_result = subprocess.run(
                    ["vm_stat"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if vm_result.returncode == 0:
                    lines = vm_result.stdout.splitlines()
                    page_size = 16384  # Apple Silicon uses 16KB pages
                    active = 0
                    wired = 0
                    for line in lines:
                        if "page size" in line.lower():
                            parts = line.split()
                            for p in parts:
                                if p.isdigit():
                                    page_size = int(p)
                                    break
                        if "Pages active:" in line:
                            active = int(line.split(":")[1].strip().rstrip("."))
                        if "Pages wired down:" in line:
                            wired = int(line.split(":")[1].strip().rstrip("."))
                    vram_used = (active + wired) * page_size
                    if vram_total > 0:
                        utilization = min(100, int((vram_used / vram_total) * 100))
            except Exception:
                pass

            gpus.append(
                {
                    "name": name,
                    "memoryTotal": vram_total,
                    "memoryUsed": vram_used,
                    "memoryFree": max(0, vram_total - vram_used),
                    "temperature": -1,  # macOS doesn't expose GPU temp without SMC
                    "utilization": utilization,
                }
            )

    except Exception as e:
        raise RuntimeError(f"Failed to parse system_profiler output: {e}")

    return gpus


@app.get("/gpu")
def get_gpu_info():
    """Return GPU metrics as a JSON array."""
    backend = detect_backend()

    if backend is None:
        return JSONResponse(
            status_code=503,
            content={"error": "No GPU backend available. Install nvidia-smi, rocm-smi, or run on macOS."},
        )

    try:
        if backend == "nvidia":
            gpus = query_nvidia()
        elif backend == "amd":
            gpus = query_amd()
        else:
            gpus = query_apple()
        return JSONResponse(content=gpus)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )


@app.get("/health")
def health_check():
    """Health check endpoint."""
    backend = detect_backend()
    return {"status": "ok", "backend": backend}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "11435"))
    uvicorn.run(app, host="0.0.0.0", port=port)
