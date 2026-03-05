"""Tests for GPU Agent."""

from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app, detect_backend, query_nvidia, query_amd, query_intel, query_apple, MIB_TO_BYTES, GIB_TO_BYTES

client = TestClient(app)

NVIDIA_SMI_OUTPUT = (
    "NVIDIA RTX 4090, 24576, 8192, 16384, 65, 45\n"
    "NVIDIA RTX 3090, 24576, 12288, 12288, 72, 80\n"
)

NVIDIA_SMI_SINGLE = "NVIDIA RTX 4090, 24576, 8192, 16384, 65, 45\n"

ROCM_SMI_OUTPUT = (
    "card series,temperature,gpu use (%),vram total memory (b),vram total used memory (b)\n"
    "AMD Radeon RX 7900 XTX,55,30,25769803776,8589934592\n"
)

import json

XPU_DISCOVERY_OUTPUT = json.dumps({
    "device_list": [
        {
            "device_id": 0,
            "device_name": "Intel Data Center GPU Flex 170",
            "memory_physical_size_byte": 16106127360,
        },
        {
            "device_id": 1,
            "device_name": "Intel Arc A770",
            "memory_physical_size_byte": 17179869184,
        },
    ]
})

XPU_STATS_DEV0 = json.dumps({
    "device_level": [
        {"metrics_type": "GPU_UTILIZATION", "avg": "45.00"},
        {"metrics_type": "GPU_CORE_TEMPERATURE", "avg": "62.00"},
        {"metrics_type": "MEMORY_USED", "avg": "8053063680"},
    ]
})

XPU_STATS_DEV1 = json.dumps({
    "device_level": [
        {"metrics_type": "GPU_UTILIZATION", "avg": "20.00"},
        {"metrics_type": "GPU_CORE_TEMPERATURE", "avg": "50.00"},
        {"metrics_type": "MEMORY_USED", "avg": "4294967296"},
    ]
})


class TestHealthEndpoint:
    """Tests for GET /health."""

    @patch("main.detect_backend", return_value="nvidia")
    def test_health_returns_ok(self, _mock):
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["backend"] == "nvidia"

    @patch("main.detect_backend", return_value=None)
    def test_health_no_backend(self, _mock):
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["backend"] is None


class TestDetectBackend:
    """Tests for backend auto-detection."""

    @patch("main.GPU_BACKEND", "nvidia")
    def test_forced_nvidia(self):
        assert detect_backend() == "nvidia"

    @patch("main.GPU_BACKEND", "amd")
    def test_forced_amd(self):
        assert detect_backend() == "amd"

    @patch("main.GPU_BACKEND", "intel")
    def test_forced_intel(self):
        assert detect_backend() == "intel"

    @patch("main.GPU_BACKEND", "apple")
    def test_forced_apple(self):
        assert detect_backend() == "apple"

    @patch("main.GPU_BACKEND", "auto")
    @patch("main.shutil.which", side_effect=lambda cmd: "/usr/bin/nvidia-smi" if cmd == "nvidia-smi" else None)
    def test_auto_detects_nvidia(self, _mock):
        assert detect_backend() == "nvidia"

    @patch("main.GPU_BACKEND", "auto")
    @patch("main.shutil.which", side_effect=lambda cmd: "/usr/bin/rocm-smi" if cmd == "rocm-smi" else None)
    def test_auto_detects_amd(self, _mock):
        assert detect_backend() == "amd"

    @patch("main.GPU_BACKEND", "auto")
    @patch("main.shutil.which", side_effect=lambda cmd: "/usr/bin/xpu-smi" if cmd == "xpu-smi" else None)
    def test_auto_detects_intel(self, _mock):
        assert detect_backend() == "intel"

    @patch("main.GPU_BACKEND", "auto")
    @patch("main.platform.system", return_value="Darwin")
    @patch("main.shutil.which", side_effect=lambda cmd: "/usr/sbin/system_profiler" if cmd == "system_profiler" else None)
    def test_auto_detects_apple(self, _mock_which, _mock_platform):
        assert detect_backend() == "apple"

    @patch("main.GPU_BACKEND", "auto")
    @patch("main.shutil.which", return_value=None)
    def test_auto_no_backend(self, _mock):
        assert detect_backend() is None


class TestQueryNvidia:
    """Tests for NVIDIA GPU queries."""

    @patch("main.subprocess.run")
    def test_parses_single_gpu(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout=NVIDIA_SMI_SINGLE, stderr="")
        gpus = query_nvidia()

        assert len(gpus) == 1
        assert gpus[0]["name"] == "NVIDIA RTX 4090"
        assert gpus[0]["memoryTotal"] == 24576 * MIB_TO_BYTES
        assert gpus[0]["memoryUsed"] == 8192 * MIB_TO_BYTES
        assert gpus[0]["memoryFree"] == 16384 * MIB_TO_BYTES
        assert gpus[0]["temperature"] == 65
        assert gpus[0]["utilization"] == 45

    @patch("main.subprocess.run")
    def test_parses_multi_gpu(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout=NVIDIA_SMI_OUTPUT, stderr="")
        gpus = query_nvidia()

        assert len(gpus) == 2
        assert gpus[0]["name"] == "NVIDIA RTX 4090"
        assert gpus[1]["name"] == "NVIDIA RTX 3090"
        assert gpus[1]["temperature"] == 72
        assert gpus[1]["utilization"] == 80

    @patch("main.subprocess.run")
    def test_handles_nvidia_smi_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="Failed")
        try:
            query_nvidia()
            assert False, "Should have raised"
        except RuntimeError as e:
            assert "nvidia-smi failed" in str(e)

    @patch("main.subprocess.run")
    def test_skips_malformed_lines(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="bad line\n", stderr="")
        gpus = query_nvidia()
        assert len(gpus) == 0


class TestQueryAmd:
    """Tests for AMD GPU queries."""

    @patch("main.subprocess.run")
    def test_parses_amd_gpu(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout=ROCM_SMI_OUTPUT, stderr="")
        gpus = query_amd()

        assert len(gpus) == 1
        assert gpus[0]["name"] == "AMD Radeon RX 7900 XTX"
        assert gpus[0]["memoryTotal"] == 25769803776
        assert gpus[0]["memoryUsed"] == 8589934592
        assert gpus[0]["memoryFree"] == 25769803776 - 8589934592
        assert gpus[0]["temperature"] == 55
        assert gpus[0]["utilization"] == 30

    @patch("main.subprocess.run")
    def test_handles_rocm_smi_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="Failed")
        try:
            query_amd()
            assert False, "Should have raised"
        except RuntimeError as e:
            assert "rocm-smi failed" in str(e)


class TestQueryIntel:
    """Tests for Intel GPU queries."""

    @patch("main.subprocess.run")
    def test_parses_multi_gpu(self, mock_run):
        def side_effect(cmd, **kwargs):
            if cmd[0] == "xpu-smi" and cmd[1] == "discovery":
                return MagicMock(returncode=0, stdout=XPU_DISCOVERY_OUTPUT, stderr="")
            if cmd[0] == "xpu-smi" and cmd[1] == "stats":
                device_id = cmd[cmd.index("-d") + 1]
                output = XPU_STATS_DEV0 if device_id == "0" else XPU_STATS_DEV1
                return MagicMock(returncode=0, stdout=output, stderr="")
            return MagicMock(returncode=1, stdout="", stderr="unknown")

        mock_run.side_effect = side_effect
        gpus = query_intel()

        assert len(gpus) == 2
        assert gpus[0]["name"] == "Intel Data Center GPU Flex 170"
        assert gpus[0]["memoryTotal"] == 16106127360
        assert gpus[0]["memoryUsed"] == 8053063680
        assert gpus[0]["memoryFree"] == 16106127360 - 8053063680
        assert gpus[0]["temperature"] == 62
        assert gpus[0]["utilization"] == 45

        assert gpus[1]["name"] == "Intel Arc A770"
        assert gpus[1]["memoryTotal"] == 17179869184
        assert gpus[1]["memoryUsed"] == 4294967296
        assert gpus[1]["temperature"] == 50
        assert gpus[1]["utilization"] == 20

    @patch("main.subprocess.run")
    def test_handles_xpu_smi_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="Failed")
        try:
            query_intel()
            assert False, "Should have raised"
        except RuntimeError as e:
            assert "xpu-smi failed" in str(e)

    @patch("main.subprocess.run")
    def test_handles_stats_failure_gracefully(self, mock_run):
        def side_effect(cmd, **kwargs):
            if cmd[1] == "discovery":
                return MagicMock(returncode=0, stdout=XPU_DISCOVERY_OUTPUT, stderr="")
            return MagicMock(returncode=1, stdout="", stderr="stats failed")

        mock_run.side_effect = side_effect
        gpus = query_intel()

        assert len(gpus) == 2
        assert gpus[0]["memoryUsed"] == 0
        assert gpus[0]["temperature"] == 0
        assert gpus[0]["utilization"] == 0

    @patch("main.subprocess.run")
    def test_flat_discovery_format(self, mock_run):
        flat_discovery = json.dumps([
            {"device_id": 0, "device_name": "Intel Arc A770", "memory_physical_size_byte": 17179869184}
        ])
        flat_stats = json.dumps({"gpu_utilization": "30", "gpu_temperature": "55", "memory_used": "4294967296"})

        def side_effect(cmd, **kwargs):
            if cmd[1] == "discovery":
                return MagicMock(returncode=0, stdout=flat_discovery, stderr="")
            return MagicMock(returncode=0, stdout=flat_stats, stderr="")

        mock_run.side_effect = side_effect
        gpus = query_intel()

        assert len(gpus) == 1
        assert gpus[0]["utilization"] == 30
        assert gpus[0]["temperature"] == 55
        assert gpus[0]["memoryUsed"] == 4294967296


class TestQueryApple:
    """Tests for Apple Silicon GPU queries."""

    SYSTEM_PROFILER_PLIST = b"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
    <dict>
        <key>_items</key>
        <array>
            <dict>
                <key>sppci_model</key>
                <string>Apple M2 Pro</string>
                <key>spdisplays_vram</key>
                <string>16 GB</string>
            </dict>
        </array>
    </dict>
</array>
</plist>"""

    @patch("main.subprocess.run")
    def test_parses_apple_gpu(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout=self.SYSTEM_PROFILER_PLIST, stderr=b"")
        gpus = query_apple()

        assert len(gpus) == 1
        assert gpus[0]["name"] == "Apple M2 Pro"
        assert gpus[0]["memoryTotal"] == 16 * GIB_TO_BYTES

    @patch("main.subprocess.run")
    def test_handles_system_profiler_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout=b"", stderr=b"Failed")
        try:
            query_apple()
            assert False, "Should have raised"
        except RuntimeError as e:
            assert "system_profiler failed" in str(e)


class TestGpuEndpoint:
    """Tests for GET /gpu endpoint."""

    @patch("main.detect_backend", return_value="nvidia")
    @patch("main.query_nvidia")
    def test_returns_nvidia_data(self, mock_query, _mock_backend):
        mock_query.return_value = [
            {
                "name": "RTX 4090",
                "memoryTotal": 24576 * MIB_TO_BYTES,
                "memoryUsed": 8192 * MIB_TO_BYTES,
                "memoryFree": 16384 * MIB_TO_BYTES,
                "temperature": 65,
                "utilization": 45,
            }
        ]
        res = client.get("/gpu")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["name"] == "RTX 4090"

    @patch("main.detect_backend", return_value="amd")
    @patch("main.query_amd")
    def test_returns_amd_data(self, mock_query, _mock_backend):
        mock_query.return_value = [
            {
                "name": "RX 7900 XTX",
                "memoryTotal": 25769803776,
                "memoryUsed": 8589934592,
                "memoryFree": 17179869184,
                "temperature": 55,
                "utilization": 30,
            }
        ]
        res = client.get("/gpu")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["name"] == "RX 7900 XTX"

    @patch("main.detect_backend", return_value="intel")
    @patch("main.query_intel")
    def test_returns_intel_data(self, mock_query, _mock_backend):
        mock_query.return_value = [
            {
                "name": "Intel Arc A770",
                "memoryTotal": 17179869184,
                "memoryUsed": 4294967296,
                "memoryFree": 12884901888,
                "temperature": 55,
                "utilization": 30,
            }
        ]
        res = client.get("/gpu")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["name"] == "Intel Arc A770"

    @patch("main.detect_backend", return_value="apple")
    @patch("main.query_apple")
    def test_returns_apple_data(self, mock_query, _mock_backend):
        mock_query.return_value = [
            {
                "name": "Apple M2 Pro",
                "memoryTotal": 16 * GIB_TO_BYTES,
                "memoryUsed": 8 * GIB_TO_BYTES,
                "memoryFree": 8 * GIB_TO_BYTES,
                "temperature": -1,
                "utilization": 50,
            }
        ]
        res = client.get("/gpu")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["name"] == "Apple M2 Pro"
        assert data[0]["temperature"] == -1

    @patch("main.detect_backend", return_value=None)
    def test_returns_503_no_backend(self, _mock):
        res = client.get("/gpu")
        assert res.status_code == 503
        assert "error" in res.json()

    @patch("main.detect_backend", return_value="nvidia")
    @patch("main.query_nvidia", side_effect=RuntimeError("nvidia-smi crashed"))
    def test_returns_500_on_error(self, _mock_query, _mock_backend):
        res = client.get("/gpu")
        assert res.status_code == 500
        assert "nvidia-smi crashed" in res.json()["error"]

    @patch("main.detect_backend", return_value="nvidia")
    @patch("main.query_nvidia", return_value=[])
    def test_returns_empty_array(self, _mock_query, _mock_backend):
        res = client.get("/gpu")
        assert res.status_code == 200
        assert res.json() == []
