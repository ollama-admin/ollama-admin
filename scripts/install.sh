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
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "\n${RED}[ERROR]${NC} $1\n"; exit 1; }
step()  { echo -e "\n${BOLD}▶ $1${NC}"; }

# ── Spinner ──
_spinner_pid=""
spinner_start() {
  local msg="$1"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  (
    i=0
    while true; do
      printf "\r  ${CYAN}${frames[$((i % 10))]}${NC}  %s" "$msg"
      sleep 0.1
      i=$((i + 1))
    done
  ) &
  _spinner_pid=$!
}
spinner_stop() {
  if [[ -n "$_spinner_pid" ]]; then
    kill "$_spinner_pid" 2>/dev/null || true
    wait "$_spinner_pid" 2>/dev/null || true
    _spinner_pid=""
    printf "\r\033[2K"
  fi
}
trap spinner_stop EXIT

# ── OS detection ──
detect_os() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macos"
  elif [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    case "$ID" in
      ubuntu|debian|linuxmint|pop) echo "debian" ;;
      fedora|rhel|centos|rocky|almalinux) echo "rpm" ;;
      arch|manjaro) echo "arch" ;;
      *) echo "linux" ;;
    esac
  else
    echo "linux"
  fi
}

docker_install_hint() {
  case "$(detect_os)" in
    macos)
      echo "  Install Docker Desktop for Mac: https://docs.docker.com/desktop/install/mac-install/"
      echo "  Or with Homebrew: brew install --cask docker"
      ;;
    debian)
      echo "  sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin"
      echo "  sudo systemctl enable --now docker"
      echo "  sudo usermod -aG docker \$USER  # log out and back in after this"
      ;;
    rpm)
      echo "  sudo dnf install -y docker docker-compose-plugin"
      echo "  sudo systemctl enable --now docker"
      echo "  sudo usermod -aG docker \$USER  # log out and back in after this"
      ;;
    arch)
      echo "  sudo pacman -S docker docker-compose"
      echo "  sudo systemctl enable --now docker"
      echo "  sudo usermod -aG docker \$USER  # log out and back in after this"
      ;;
    *)
      echo "  https://docs.docker.com/get-docker/"
      ;;
  esac
}

echo ""
echo -e "${CYAN}${BOLD}"
echo '  ██████╗ ██╗     ██╗      █████╗ ███╗   ███╗ █████╗ '
echo ' ██╔═══██╗██║     ██║     ██╔══██╗████╗ ████║██╔══██╗'
echo ' ██║   ██║██║     ██║     ███████║██╔████╔██║███████║'
echo ' ██║   ██║██║     ██║     ██╔══██║██║╚██╔╝██║██╔══██║'
echo ' ╚██████╔╝███████╗███████╗██║  ██║██║ ╚═╝ ██║██║  ██║'
echo '  ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝'
echo -e "${NC}${BOLD}"
echo '            █████╗ ██████╗ ███╗   ███╗██╗███╗   ██╗  '
echo '           ██╔══██╗██╔══██╗████╗ ████║██║████╗  ██║  '
echo '           ███████║██║  ██║██╔████╔██║██║██╔██╗ ██║  '
echo '           ██╔══██║██║  ██║██║╚██╔╝██║██║██║╚██╗██║  '
echo '           ██║  ██║██████╔╝██║ ╚═╝ ██║██║██║ ╚████║  '
echo '           ╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝  '
echo -e "${NC}"

# ── Preflight: Docker ──
step "Checking prerequisites"

if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}[ERROR]${NC} Docker is not installed.\n"
  echo -e "  Install it for your system:"
  docker_install_hint
  echo ""
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  case "$(detect_os)" in
    macos)
      fail "Docker is installed but not running. Open Docker Desktop and wait for it to start."
      ;;
    *)
      fail "Docker daemon is not running.\n\n  sudo systemctl start docker"
      ;;
  esac
fi

if command -v docker compose >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo -e "${RED}[ERROR]${NC} Docker Compose is not installed.\n"
  echo -e "  Install it:"
  case "$(detect_os)" in
    macos)   echo "  Already bundled with Docker Desktop — reinstall it." ;;
    debian)  echo "  sudo apt-get install -y docker-compose-plugin" ;;
    rpm)     echo "  sudo dnf install -y docker-compose-plugin" ;;
    *)       echo "  https://docs.docker.com/compose/install/" ;;
  esac
  echo ""
  exit 1
fi

ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') · Compose detected"

# ── Preflight: Ollama ──
OLLAMA_CHECK_URL="${OLLAMA_URL/host.docker.internal/localhost}"
if curl -sf --max-time 3 "${OLLAMA_CHECK_URL}/api/tags" >/dev/null 2>&1; then
  ok "Ollama is reachable at ${OLLAMA_CHECK_URL}"
else
  warn "Could not reach Ollama at ${OLLAMA_CHECK_URL}"
  echo ""

  if command -v ollama >/dev/null 2>&1; then
    # Ollama is installed but not running
    echo -e "  Ollama is installed but not running."
    echo -e "  Start it with: ${BOLD}ollama serve${NC}"
    echo ""
    read -rp "  Start Ollama now and continue? [Y/n] " _start_ollama
    if [[ ! "$_start_ollama" =~ ^[Nn]$ ]]; then
      ollama serve >/dev/null 2>&1 &
      spinner_start "Waiting for Ollama to start ..."
      for i in $(seq 1 10); do
        sleep 1
        if curl -sf --max-time 2 "${OLLAMA_CHECK_URL}/api/tags" >/dev/null 2>&1; then
          spinner_stop
          ok "Ollama is running"
          break
        fi
      done
      spinner_stop
      if ! curl -sf --max-time 2 "${OLLAMA_CHECK_URL}/api/tags" >/dev/null 2>&1; then
        warn "Ollama did not respond in time. You can start it manually later."
      fi
    fi
  else
    # Ollama is not installed — offer to install it
    echo -e "  Ollama is not installed on this machine."
    echo ""
    read -rp "  Install Ollama now? [Y/n] " _install_ollama
    if [[ ! "$_install_ollama" =~ ^[Nn]$ ]]; then
      step "Installing Ollama"
      if [[ "$(detect_os)" == "macos" ]]; then
        if command -v brew >/dev/null 2>&1; then
          brew install ollama
        else
          spinner_start "Downloading Ollama installer ..."
          curl -fsSL https://ollama.com/install.sh | sh
          spinner_stop
        fi
      else
        spinner_start "Downloading Ollama installer ..."
        curl -fsSL https://ollama.com/install.sh | sh
        spinner_stop
      fi

      # Start Ollama after install
      if command -v ollama >/dev/null 2>&1; then
        ok "Ollama installed"
        ollama serve >/dev/null 2>&1 &
        spinner_start "Starting Ollama ..."
        for i in $(seq 1 10); do
          sleep 1
          if curl -sf --max-time 2 "${OLLAMA_CHECK_URL}/api/tags" >/dev/null 2>&1; then
            spinner_stop
            ok "Ollama is running"
            break
          fi
        done
        spinner_stop
      else
        warn "Ollama installation did not complete. Install it manually: https://ollama.com"
      fi
    else
      warn "Skipping Ollama. You can configure it later from the setup wizard."
    fi
  fi
fi

# ── Create install directory ──
step "Setting up installation directory"
info "Installing to ${INSTALL_DIR}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── Generate docker-compose.yml ──
info "Generating docker-compose.yml"
cat > docker-compose.yml <<YAML
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
      LOG_RETENTION_DAYS: \${LOG_RETENTION_DAYS:-90}
      GPU_AGENT_ENABLED: \${GPU_AGENT_ENABLED:-false}
    volumes:
      - ollama-admin-data:/data
    restart: unless-stopped

volumes:
  ollama-admin-data:
YAML
ok "docker-compose.yml created"

# ── Pull image ──
step "Pulling Docker image"
spinner_start "Pulling ${IMAGE}:${VERSION} (this may take a few minutes) ..."
if docker pull "${IMAGE}:${VERSION}" >/dev/null 2>&1; then
  spinner_stop
  ok "Image pulled successfully"
else
  spinner_stop
  # Retry with visible output so the user sees what went wrong
  docker pull "${IMAGE}:${VERSION}" || fail "Failed to pull image. Check your internet connection or try again."
fi

# ── Start ──
step "Starting Ollama Admin"
spinner_start "Starting container ..."
$COMPOSE up -d >/dev/null 2>&1
spinner_stop
ok "Container started"

# ── Health check ──
step "Waiting for app to be ready"
HEALTH_URL="http://localhost:${PORT}/api/health"
ready=false
for i in $(seq 1 20); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    ready=true
    break
  fi
  spinner_start "Waiting for health check (${i}/20) ..."
  sleep 2
  spinner_stop
done

if $ready; then
  ok "App is healthy"
else
  warn "App started but health check is not responding yet — it may still be initialising."
  warn "Check logs: cd ${INSTALL_DIR} && ${COMPOSE} logs -f"
fi

# ── Done ──
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║     ✔  Ollama Admin is running!      ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}       http://localhost:${PORT}"
echo -e "  ${BOLD}Data:${NC}      ${INSTALL_DIR}"
echo -e "  ${BOLD}Version:${NC}   ${VERSION}"
echo ""
echo -e "  ${CYAN}Open the URL above to complete the setup wizard.${NC}"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} logs -f              # View logs"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} down                 # Stop"
echo -e "    cd ${INSTALL_DIR} && ${COMPOSE} pull && ${COMPOSE} up -d  # Update"
echo ""
