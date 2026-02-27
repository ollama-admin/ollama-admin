"""
Ollama Admin GPU Agent — Lightweight sidecar that exposes GPU metrics via HTTP.

Supports NVIDIA GPUs (nvidia-smi) and AMD GPUs (rocm-smi).
Deploy alongside each Ollama server to enable GPU monitoring in Ollama Admin.
"""

import os
import shutil
import subprocess
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="Ollama Admin GPU Agent", version="1.0.0")

MIB_TO_BYTES = 1024 * 1024
GPU_BACKEND = os.getenv("GPU_BACKEND", "auto")


def detect_backend() -> str | None:
    """Detect available GPU backend: nvidia, amd, or None."""
    if GPU_BACKEND in ("nvidia", "amd"):
        return GPU_BACKEND
    if shutil.which("nvidia-smi"):
        return "nvidia"
    if shutil.which("rocm-smi"):
        return "amd"
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


@app.get("/gpu")
def get_gpu_info():
    """Return GPU metrics as a JSON array."""
    backend = detect_backend()

    if backend is None:
        return JSONResponse(
            status_code=503,
            content={"error": "No GPU backend available. Install nvidia-smi or rocm-smi."},
        )

    try:
        if backend == "nvidia":
            gpus = query_nvidia()
        else:
            gpus = query_amd()
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
