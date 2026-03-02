#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Ollama Admin GPU Agent — One-line installer
# Install on any server with an NVIDIA GPU.
# Usage: curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install-gpu-agent.sh | bash
# ─────────────────────────────────────────────

IMAGE="ghcr.io/ollama-admin/ollama-admin-gpu-agent"
VERSION="${GPU_AGENT_VERSION:-latest}"
INSTALL_DIR="${GPU_AGENT_DIR:-$HOME/ollama-admin-gpu-agent}"
PORT="${GPU_AGENT_PORT:-11435}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║    Ollama Admin GPU Agent Installer   ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Preflight checks ──
command -v docker >/dev/null 2>&1 || fail "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 || fail "Docker daemon is not running."

if command -v docker compose >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  fail "Docker Compose is not installed."
fi

ok "Docker and Docker Compose detected"

# ── Check NVIDIA runtime ──
if docker info 2>/dev/null | grep -q "nvidia"; then
  ok "NVIDIA Container Runtime detected"
else
  warn "NVIDIA Container Runtime not detected."
  warn "Install it: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
  echo ""
  read -rp "Continue anyway? (y/N) " response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# ── Create install directory ──
info "Installing to ${INSTALL_DIR}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── Generate docker-compose.yml ──
info "Creating docker-compose.yml"
cat > docker-compose.yml <<YAML
version: "3.9"

services:
  gpu-agent:
    image: ${IMAGE}:${VERSION}
    runtime: nvidia
    environment:
      NVIDIA_VISIBLE_DEVICES: all
    ports:
      - "${PORT}:11435"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11435/health"]
      interval: 30s
      timeout: 5s
      retries: 3
YAML

ok "docker-compose.yml created"

# ── Pull and start ──
info "Pulling ${IMAGE}:${VERSION}"
docker pull "${IMAGE}:${VERSION}"

info "Starting GPU Agent"
$COMPOSE up -d

# ── Wait for health check ──
info "Waiting for GPU Agent to be ready..."
for i in $(seq 1 10); do
  if curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
  ok "GPU Agent is healthy"
else
  warn "GPU Agent started but health check is not responding yet."
  warn "Check logs: cd ${INSTALL_DIR} && ${COMPOSE} logs"
fi

# ── Get server IP for instructions ──
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "<this-server-ip>")

echo ""
echo -e "${GREEN}${BOLD}✔ GPU Agent is running!${NC}"
echo ""
echo -e "  ${BOLD}Endpoint:${NC}  http://${SERVER_IP}:${PORT}"
echo -e "  ${BOLD}Health:${NC}    http://${SERVER_IP}:${PORT}/health"
echo -e "  ${BOLD}Data:${NC}      ${INSTALL_DIR}"
echo -e "  ${BOLD}Version:${NC}   ${VERSION}"
echo ""
echo -e "  ${CYAN}Next step:${NC}"
echo -e "  In Ollama Admin → Server settings → set GPU Agent URL to:"
echo -e "  ${BOLD}http://${SERVER_IP}:${PORT}${NC}"
echo ""
echo -e "  ${CYAN}Commands:${NC}"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} logs -f     # View logs"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} down         # Stop"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} pull && ${COMPOSE} up -d  # Update"
echo ""
