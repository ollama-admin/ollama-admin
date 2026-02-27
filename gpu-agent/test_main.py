"""Tests for GPU Agent."""

from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app, detect_backend, query_nvidia, query_amd, MIB_TO_BYTES

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

    @patch("main.GPU_BACKEND", "auto")
    @patch("main.shutil.which", side_effect=lambda cmd: "/usr/bin/nvidia-smi" if cmd == "nvidia-smi" else None)
    def test_auto_detects_nvidia(self, _mock):
        assert detect_backend() == "nvidia"

    @patch("main.GPU_BACKEND", "auto")
    @patch("main.shutil.which", side_effect=lambda cmd: "/usr/bin/rocm-smi" if cmd == "rocm-smi" else None)
    def test_auto_detects_amd(self, _mock):
        assert detect_backend() == "amd"

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
