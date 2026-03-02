#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Ollama Admin — One-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install.sh | bash
# ─────────────────────────────────────────────

IMAGE="ghcr.io/ollama-admin/ollama-admin"
VERSION="${OLLAMA_ADMIN_VERSION:-latest}"
INSTALL_DIR="${OLLAMA_ADMIN_DIR:-$HOME/ollama-admin}"
PORT="${OLLAMA_ADMIN_PORT:-3000}"
OLLAMA_URL="${DEFAULT_OLLAMA_URL:-http://host.docker.internal:11434}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
fail()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        Ollama Admin Installer        ║${NC}"
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

# ── Create install directory ──
info "Installing to ${INSTALL_DIR}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── Generate docker-compose.yml ──
info "Creating docker-compose.yml"
cat > docker-compose.yml <<YAML
version: "3.9"

services:
  ollama-admin:
    image: ${IMAGE}:${VERSION}
    ports:
      - "${PORT}:3000"
    environment:
      DATABASE_URL: \${DATABASE_URL:-file:/data/ollama-admin.db}
      DEFAULT_OLLAMA_URL: \${DEFAULT_OLLAMA_URL:-${OLLAMA_URL}}
      NEXTAUTH_SECRET: \${NEXTAUTH_SECRET:-$(openssl rand -hex 32)}
      NEXTAUTH_URL: \${NEXTAUTH_URL:-http://localhost:${PORT}}
      AUTH_ENABLED: \${AUTH_ENABLED:-false}
      LOG_RETENTION_DAYS: \${LOG_RETENTION_DAYS:-90}
      GPU_AGENT_ENABLED: \${GPU_AGENT_ENABLED:-false}
    volumes:
      - ollama-admin-data:/data
    restart: unless-stopped

volumes:
  ollama-admin-data:
YAML

ok "docker-compose.yml created"

# ── Pull and start ──
info "Pulling ${IMAGE}:${VERSION}"
docker pull "${IMAGE}:${VERSION}"

info "Starting Ollama Admin"
$COMPOSE up -d

echo ""
echo -e "${GREEN}${BOLD}✔ Ollama Admin is running!${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}       http://localhost:${PORT}"
echo -e "  ${BOLD}Data:${NC}      ${INSTALL_DIR}"
echo -e "  ${BOLD}Version:${NC}   ${VERSION}"
echo ""
echo -e "  ${CYAN}Commands:${NC}"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} logs -f     # View logs"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} down         # Stop"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} pull && ${COMPOSE} up -d  # Update"
echo ""
