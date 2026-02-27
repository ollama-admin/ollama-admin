# Ollama Admin GPU Agent

Lightweight sidecar that exposes GPU metrics via HTTP for Ollama Admin.

## Supported GPUs

- **NVIDIA** — via `nvidia-smi` (auto-detected)
- **AMD** — via `rocm-smi` (auto-detected)

## Quick Start

### Docker (recommended)

```bash
docker compose up gpu-agent
```

Requires [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed on the host.

### Standalone

```bash
cd gpu-agent
pip install -r requirements.txt
python main.py
```

The agent starts on port `11435` by default.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `11435` | HTTP server port |
| `GPU_BACKEND` | `auto` | Force backend: `nvidia`, `amd`, or `auto` |
| `NVIDIA_VISIBLE_DEVICES` | — | Which GPUs to expose (Docker) |

## API

### `GET /gpu`

Returns a JSON array of GPU objects:

```json
[
  {
    "name": "NVIDIA RTX 4090",
    "memoryTotal": 25769803776,
    "memoryUsed": 8589934592,
    "memoryFree": 17179869184,
    "temperature": 65,
    "utilization": 45
  }
]
```

| Field | Type | Unit |
|---|---|---|
| `name` | string | — |
| `memoryTotal` | number | bytes |
| `memoryUsed` | number | bytes |
| `memoryFree` | number | bytes |
| `temperature` | number | °C |
| `utilization` | number | % (0-100) |

Returns `503` if no GPU backend is available.

### `GET /health`

```json
{"status": "ok", "backend": "nvidia"}
```

## Integration with Ollama Admin

1. Deploy the GPU agent on the same machine as your Ollama server
2. In Ollama Admin, edit the server and set **GPU Agent URL** to `http://<host>:11435`
3. The GPU monitoring page will start showing hardware metrics
