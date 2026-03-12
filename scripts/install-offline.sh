#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Ollama Admin — Offline Installer
# Run this on your TARGET server (no internet required).
# Requires a bundle created by bundle.sh.
#
# Usage:
#   bash install-offline.sh --bundle <path-to-bundle.tar.gz> [options]
#
# Options:
#   --bundle <path>           Path to the bundle tar.gz (required)
#   --install-dir <dir>       Installation directory (default: $HOME/ollama-admin)
#   --port <port>             Web app port (default: 3000)
#   --ollama-url <url>        Ollama server URL (default: http://host.docker.internal:11434)
#   --with-gpu-agent          Enable GPU agent service
#   --gpu-port <port>         GPU agent port (default: 11435)
#   --gpu-backend <nvidia|amd> GPU type (default: nvidia)
#   --nextauth-secret <str>   JWT secret (default: auto-generated)
#   --nextauth-url <url>      App public URL (default: http://localhost:<port>)
# ─────────────────────────────────────────────

BUNDLE=""
INSTALL_DIR="${OLLAMA_ADMIN_DIR:-$HOME/ollama-admin}"
PORT="${OLLAMA_ADMIN_PORT:-3000}"
OLLAMA_URL="${DEFAULT_OLLAMA_URL:-http://host.docker.internal:11434}"
WITH_GPU_AGENT=false
GPU_PORT="${GPU_AGENT_PORT:-11435}"
GPU_BACKEND="nvidia"
NEXTAUTH_SECRET=""
NEXTAUTH_URL=""

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

# ── Parse arguments ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle)          BUNDLE="$2";           shift 2 ;;
    --install-dir)     INSTALL_DIR="$2";      shift 2 ;;
    --port)            PORT="$2";             shift 2 ;;
    --ollama-url)      OLLAMA_URL="$2";       shift 2 ;;
    --with-gpu-agent)  WITH_GPU_AGENT=true;   shift ;;
    --gpu-port)        GPU_PORT="$2";         shift 2 ;;
    --gpu-backend)     GPU_BACKEND="$2";      shift 2 ;;
    --nextauth-secret) NEXTAUTH_SECRET="$2";  shift 2 ;;
    --nextauth-url)    NEXTAUTH_URL="$2";     shift 2 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

[[ -n "$BUNDLE" ]]                        || fail "--bundle is required. Run: bash install-offline.sh --bundle <path>"
[[ -f "$BUNDLE" ]]                        || fail "Bundle not found: $BUNDLE"
[[ "$GPU_BACKEND" =~ ^(nvidia|amd)$ ]]    || fail "--gpu-backend must be 'nvidia' or 'amd'"

NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:${PORT}}"

# ── Generate secret if not provided ──
if [[ -z "$NEXTAUTH_SECRET" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    NEXTAUTH_SECRET=$(openssl rand -hex 32)
  else
    NEXTAUTH_SECRET=$(tr -dc 'a-f0-9' < /dev/urandom 2>/dev/null | head -c 64 || fail "Cannot generate secret: install openssl or pass --nextauth-secret")
  fi
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Ollama Admin — Offline Installer   ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Preflight checks ──
command -v docker >/dev/null 2>&1 || fail "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1       || fail "Docker daemon is not running."

if command -v docker compose >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  fail "Docker Compose is not installed."
fi
ok "Docker and Docker Compose detected"

# ── Extract bundle ──
TMPDIR_EXTRACT=$(mktemp -d)
trap 'rm -rf "$TMPDIR_EXTRACT"' EXIT

info "Extracting bundle: ${BUNDLE} ..."
tar -xzf "$BUNDLE" -C "$TMPDIR_EXTRACT"

BUNDLE_DIR=$(find "$TMPDIR_EXTRACT" -maxdepth 1 -mindepth 1 -type d | head -1)
[[ -d "$BUNDLE_DIR" ]] || fail "Bundle structure invalid — expected a single top-level directory"

# ── Read META ──
META_FILE="${BUNDLE_DIR}/META"
[[ -f "$META_FILE" ]] || fail "META file missing from bundle — bundle may be corrupt"

APP_IMAGE=$(grep '^app_image=' "$META_FILE" | cut -d= -f2)
GPU_IMAGE=$(grep '^gpu_agent_image=' "$META_FILE" | cut -d= -f2 || true)
BUNDLE_VERSION=$(grep '^version=' "$META_FILE" | cut -d= -f2)

ok "Bundle version: ${BUNDLE_VERSION}"
info "App image: ${APP_IMAGE}"

# ── Load main app image ──
APP_TAR="${BUNDLE_DIR}/ollama-admin.tar.gz"
[[ -f "$APP_TAR" ]] || fail "Main app image missing from bundle: ollama-admin.tar.gz"

info "Loading main app image ..."
docker load < "$APP_TAR"
ok "Main app image loaded"

# ── Load GPU agent image (optional) ──
GPU_TAR="${BUNDLE_DIR}/ollama-admin-gpu-agent.tar.gz"
HAS_GPU_IMAGE=false

if [[ -f "$GPU_TAR" ]]; then
  HAS_GPU_IMAGE=true
  if $WITH_GPU_AGENT; then
    info "Loading GPU agent image ..."
    docker load < "$GPU_TAR"
    ok "GPU agent image loaded"
  else
    warn "GPU agent image is in the bundle but --with-gpu-agent was not passed. Skipping."
  fi
elif $WITH_GPU_AGENT; then
  fail "GPU agent image not found in bundle. Re-create the bundle with --with-gpu-agent."
fi

# ── Create install directory ──
info "Installing to ${INSTALL_DIR}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── Generate docker-compose.yml ──
info "Creating docker-compose.yml ..."

if $WITH_GPU_AGENT && [[ "$GPU_BACKEND" == "amd" ]]; then
  GPU_SERVICE_BLOCK=$(cat <<YAML

  gpu-agent:
    image: ${GPU_IMAGE}
    environment:
      GPU_BACKEND: amd
    devices:
      - /dev/kfd:/dev/kfd
      - /dev/dri:/dev/dri
    group_add:
      - video
      - render
    ports:
      - "${GPU_PORT}:11435"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11435/health"]
      interval: 30s
      timeout: 5s
      retries: 3
YAML
)
elif $WITH_GPU_AGENT; then
  GPU_SERVICE_BLOCK=$(cat <<YAML

  gpu-agent:
    image: ${GPU_IMAGE}
    runtime: nvidia
    environment:
      NVIDIA_VISIBLE_DEVICES: all
      GPU_BACKEND: nvidia
    ports:
      - "${GPU_PORT}:11435"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11435/health"]
      interval: 30s
      timeout: 5s
      retries: 3
YAML
)
else
  GPU_SERVICE_BLOCK=""
fi

GPU_AGENT_ENABLED="false"
$WITH_GPU_AGENT && GPU_AGENT_ENABLED="true"

cat > docker-compose.yml <<YAML
services:
  ollama-admin:
    image: ${APP_IMAGE}
    ports:
      - "${PORT}:3000"
    environment:
      DATABASE_URL: \${DATABASE_URL:-file:/data/ollama-admin.db}
      DEFAULT_OLLAMA_URL: \${DEFAULT_OLLAMA_URL:-${OLLAMA_URL}}
      NEXTAUTH_SECRET: \${NEXTAUTH_SECRET:-${NEXTAUTH_SECRET}}
      NEXTAUTH_URL: \${NEXTAUTH_URL:-${NEXTAUTH_URL}}
      LOG_RETENTION_DAYS: \${LOG_RETENTION_DAYS:-90}
      LOG_STORE_PROMPTS: \${LOG_STORE_PROMPTS:-true}
      GPU_AGENT_ENABLED: \${GPU_AGENT_ENABLED:-${GPU_AGENT_ENABLED}}
    volumes:
      - ollama-admin-data:/data
    restart: unless-stopped
${GPU_SERVICE_BLOCK}
volumes:
  ollama-admin-data:
YAML

ok "docker-compose.yml created"

# ── Start services ──
info "Starting Ollama Admin ..."
$COMPOSE up -d

# ── Health check ──
info "Waiting for Ollama Admin to be ready ..."
HEALTH_URL="http://localhost:${PORT}/api/health"
for i in $(seq 1 15); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
  ok "Ollama Admin is healthy"
else
  warn "Service started but health check is not responding yet."
  warn "Check logs: cd ${INSTALL_DIR} && ${COMPOSE} logs -f"
fi

# ── Summary ──
echo ""
echo -e "${GREEN}${BOLD}✔ Ollama Admin is running!${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}        http://localhost:${PORT}"
echo -e "  ${BOLD}Data:${NC}       ${INSTALL_DIR}"
echo -e "  ${BOLD}Version:${NC}    ${BUNDLE_VERSION}"
if $WITH_GPU_AGENT; then
  echo -e "  ${BOLD}GPU Agent:${NC}  http://localhost:${GPU_PORT}  (${GPU_BACKEND})"
fi
echo ""
echo -e "  ${CYAN}First time? Open the URL above to complete the setup wizard.${NC}"
echo ""
echo -e "  ${CYAN}Commands:${NC}"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} logs -f          # View logs"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} down             # Stop"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} up -d            # Start"
echo ""
