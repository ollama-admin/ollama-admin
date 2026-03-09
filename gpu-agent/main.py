"""
Ollama Admin GPU Agent — Lightweight sidecar that exposes GPU metrics via HTTP.

Supports NVIDIA (nvidia-smi), AMD (rocm-smi), Intel (xpu-smi), and Apple Silicon (Metal).
Deploy alongside each Ollama server to enable GPU monitoring in Ollama Admin.
"""

import json
import os
import platform
import plistlib
import shutil
import subprocess

from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="Ollama Admin GPU Agent", version="1.2.0")

MIB_TO_BYTES = 1024 * 1024
GIB_TO_BYTES = 1024 * 1024 * 1024
GPU_BACKEND = os.getenv("GPU_BACKEND", "auto")


def detect_backend() -> str | None:
    """Detect available GPU backend: nvidia, amd, intel, apple, or None."""
    if GPU_BACKEND in ("nvidia", "amd", "intel", "apple"):
        return GPU_BACKEND
    if shutil.which("nvidia-smi"):
        return "nvidia"
    if shutil.which("rocm-smi"):
        return "amd"
    if shutil.which("xpu-smi"):
        return "intel"
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

        name = row.get("card series", row.get("device name", "AMD GPU"))
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


def query_intel() -> list[dict]:
    """Query Intel GPUs using xpu-smi."""
    disc_result = subprocess.run(
        ["xpu-smi", "discovery", "--json"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if disc_result.returncode != 0:
        raise RuntimeError(f"xpu-smi failed: {disc_result.stderr.strip()}")

    discovery = json.loads(disc_result.stdout)
    device_list = (
        discovery if isinstance(discovery, list) else discovery.get("device_list", [])
    )

    gpus = []
    for dev in device_list:
        device_id = dev.get("device_id", 0)
        name = dev.get("device_name", "Intel GPU")
        mem_total = int(dev.get("memory_physical_size_byte", 0))

        mem_used = 0
        temperature = 0
        utilization = 0

        try:
            stats_result = subprocess.run(
                ["xpu-smi", "stats", "-d", str(device_id), "--json"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if stats_result.returncode == 0:
                data = json.loads(stats_result.stdout)
                if "device_level" in data:
                    for m in data["device_level"]:
                        mtype = m.get("metrics_type", "")
                        value = float(m.get("value", m.get("avg", 0)))
                        if mtype == "GPU_UTILIZATION":
                            utilization = int(value)
                        elif "TEMPERATURE" in mtype and temperature == 0:
                            temperature = int(value)
                        elif mtype == "MEMORY_USED":
                            mem_used = int(value)
                else:
                    utilization = int(float(data.get("gpu_utilization", 0)))
                    temperature = int(float(data.get("gpu_temperature", 0)))
                    mem_used = int(float(data.get("memory_used", 0)))
        except (subprocess.TimeoutExpired, json.JSONDecodeError):
            pass

        gpus.append(
            {
                "name": name,
                "memoryTotal": mem_total,
                "memoryUsed": mem_used,
                "memoryFree": mem_total - mem_used,
                "temperature": temperature,
                "utilization": utilization,
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

            vram_str = display.get("spdisplays_vram", display.get("sppci_vram", "0"))
            if isinstance(vram_str, str):
                vram_str = vram_str.upper().replace(" ", "")
                if "GB" in vram_str:
                    vram_total = int(float(vram_str.replace("GB", ""))) * GIB_TO_BYTES
                elif "MB" in vram_str:
                    vram_total = int(float(vram_str.replace("MB", ""))) * MIB_TO_BYTES
                else:
                    vram_total = int(float(vram_str)) if vram_str.isdigit() else 0
            else:
                vram_total = int(vram_str) if vram_str else 0

            if vram_total == 0:
                mem_result = subprocess.run(
                    ["sysctl", "-n", "hw.memsize"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if mem_result.returncode == 0:
                    vram_total = int(mem_result.stdout.strip())

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
                    page_size = 16384
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
                    "temperature": -1,
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
            content={
                "error": "No GPU backend available. "
                "Install nvidia-smi, rocm-smi, xpu-smi, or run on macOS."
            },
        )

    try:
        if backend == "nvidia":
            gpus = query_nvidia()
        elif backend == "amd":
            gpus = query_amd()
        elif backend == "intel":
            gpus = query_intel()
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
