#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
#  Ollama Admin — Interactive Installer
#  Usage: curl -fsSL https://get.ollama-admin.com | bash
# ============================================================================

VERSION="${OLLAMA_ADMIN_VERSION:-latest}"
INSTALL_DIR="${OLLAMA_ADMIN_DIR:-$HOME/ollama-admin}"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
ENV_FILE="$INSTALL_DIR/.env"

# -- Colors & Symbols --------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

CHECK="${GREEN}\xe2\x9c\x94${NC}"
CROSS="${RED}\xe2\x9c\x98${NC}"
ARROW="${CYAN}\xe2\x96\xb6${NC}"
WARN="${YELLOW}\xe2\x9a\xa0${NC}"

# -- Helpers -----------------------------------------------------------------

print_banner() {
  printf "\n"
  printf "${MAGENTA}${BOLD}"
  printf "  ___  _ _                            _           _       \n"
  printf " / _ \\| | | __ _ _ __ ___   __ _     / \\   __| |_ __ ___ (_)_ __  \n"
  printf "| | | | | |/ _\` | '_ \` _ \\ / _\` |   / _ \\ / _\` | '_ \` _ \\| | '_ \\ \n"
  printf "| |_| | | | (_| | | | | | | (_| |  / ___ \\ (_| | | | | | | | | | |\n"
  printf " \\___/|_|_|\\__,_|_| |_| |_|\\__,_| /_/   \\_\\__,_|_| |_| |_|_|_| |_|\n"
  printf "${NC}\n"
  printf "  ${DIM}Administration panel, chat client & observability gateway for Ollama${NC}\n"
  printf "\n"
}

print_step() {
  printf "\n${BLUE}${BOLD}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}\n"
}

print_ok() {
  printf "  ${CHECK} $1\n"
}

print_warn() {
  printf "  ${WARN} ${YELLOW}$1${NC}\n"
}

print_fail() {
  printf "  ${CROSS} ${RED}$1${NC}\n"
}

print_info() {
  printf "  ${ARROW} $1\n"
}

spin() {
  local pid=$1
  local msg=$2
  local frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYAN}${frames:i%${#frames}:1}${NC} ${msg}"
    i=$((i + 1))
    sleep 0.1
  done
  wait "$pid" 2>/dev/null
  local exit_code=$?
  printf "\r"
  return $exit_code
}

prompt_choice() {
  local prompt=$1
  shift
  local options=("$@")
  local selected=0
  local count=${#options[@]}

  # If not interactive, default to first option
  if [ ! -t 0 ]; then
    printf "  ${options[0]}\n"
    echo 0
    return
  fi

  # Hide cursor
  printf "\033[?25l"
  trap 'printf "\033[?25h"' EXIT

  while true; do
    # Print options
    for i in "${!options[@]}"; do
      if [ $i -eq $selected ]; then
        printf "\r  ${CYAN}${BOLD}> ${options[$i]}${NC}\n"
      else
        printf "\r    ${DIM}${options[$i]}${NC}\n"
      fi
    done

    # Read single keypress
    read -rsn1 key
    case "$key" in
      A|k) # Up arrow or k
        selected=$(( (selected - 1 + count) % count ))
        ;;
      B|j) # Down arrow or j
        selected=$(( (selected + 1) % count ))
        ;;
      '') # Enter
        printf "\033[?25h"
        echo $selected
        return
        ;;
    esac

    # Move cursor back up
    printf "\033[${count}A"
  done
}

prompt_input() {
  local prompt=$1
  local default=$2
  local value

  if [ ! -t 0 ]; then
    echo "$default"
    return
  fi

  printf "  ${BOLD}$prompt${NC}"
  if [ -n "$default" ]; then
    printf " ${DIM}($default)${NC}"
  fi
  printf ": "
  read -r value
  echo "${value:-$default}"
}

prompt_password() {
  local prompt=$1
  local value

  if [ ! -t 0 ]; then
    echo "changeme"
    return
  fi

  printf "  ${BOLD}$prompt${NC}: "
  read -rs value
  printf "\n"
  echo "$value"
}

generate_secret() {
  openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n'
}

TOTAL_STEPS=5

# ============================================================================
#  MAIN
# ============================================================================

main() {
  print_banner

  # ---- Step 1: Check prerequisites ----------------------------------------

  print_step 1 "Checking prerequisites"

  # OS check
  local os
  os="$(uname -s)"
  case "$os" in
    Linux)  print_ok "Operating system: Linux" ;;
    Darwin) print_ok "Operating system: macOS" ;;
    *)
      print_fail "Unsupported OS: $os (Linux and macOS only)"
      exit 1
      ;;
  esac

  # Docker
  if command -v docker &>/dev/null; then
    local docker_ver
    docker_ver=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    print_ok "Docker found: v${docker_ver}"
  else
    print_warn "Docker not found"
    printf "\n"
    print_info "Docker is required. Install it now?"
    printf "\n"
    local install_docker
    install_docker=$(prompt_choice "Install Docker?" "Yes, install Docker" "No, I'll install it myself")

    if [ "$install_docker" -eq 0 ]; then
      printf "\n"
      print_info "Installing Docker..."
      curl -fsSL https://get.docker.com | sh &
      spin $! "Installing Docker (this may take a minute)..."
      print_ok "Docker installed"

      # Start Docker service
      if command -v systemctl &>/dev/null; then
        sudo systemctl start docker 2>/dev/null || true
        sudo systemctl enable docker 2>/dev/null || true
      fi

      # Add current user to docker group
      if [ "$(uname -s)" = "Linux" ]; then
        sudo usermod -aG docker "$USER" 2>/dev/null || true
        print_info "Added $USER to docker group (may require logout/login)"
      fi
    else
      print_fail "Docker is required. Install it from https://docs.docker.com/get-docker/"
      exit 1
    fi
  fi

  # Docker Compose
  if docker compose version &>/dev/null; then
    local compose_ver
    compose_ver=$(docker compose version --short 2>/dev/null || echo "unknown")
    print_ok "Docker Compose found: v${compose_ver}"
  elif command -v docker-compose &>/dev/null; then
    print_ok "Docker Compose found (standalone)"
  else
    print_fail "Docker Compose not found. It should be included with Docker Desktop."
    print_info "Install: https://docs.docker.com/compose/install/"
    exit 1
  fi

  # ---- Step 2: Database configuration ------------------------------------

  print_step 2 "Database configuration"

  printf "\n"
  print_info "Choose your database:"
  printf "\n"

  local db_choice
  db_choice=$(prompt_choice "Database" \
    "SQLite (local, zero config — recommended for small teams)" \
    "PostgreSQL (external, scalable — recommended for production)")

  local db_url=""
  local use_postgres=false

  if [ "$db_choice" -eq 1 ]; then
    use_postgres=true
    printf "\n"

    local pg_host pg_port pg_user pg_pass pg_name

    pg_host=$(prompt_input "PostgreSQL host" "localhost")
    pg_port=$(prompt_input "PostgreSQL port" "5432")
    pg_name=$(prompt_input "Database name" "ollamaadmin")
    pg_user=$(prompt_input "Username" "ollamaadmin")
    pg_pass=$(prompt_password "Password")

    if [ -z "$pg_pass" ]; then
      print_fail "Password cannot be empty"
      exit 1
    fi

    db_url="postgresql://${pg_user}:${pg_pass}@${pg_host}:${pg_port}/${pg_name}"

    # Test connection
    printf "\n"
    print_info "Testing PostgreSQL connection..."

    # Use a temporary Docker container to test the connection
    if docker run --rm --network host postgres:16-alpine \
      pg_isready -h "$pg_host" -p "$pg_port" -U "$pg_user" -d "$pg_name" -t 5 &>/dev/null; then
      print_ok "PostgreSQL connection successful"
    else
      print_warn "Could not verify PostgreSQL connection"
      print_info "The installer will continue, but make sure PostgreSQL is reachable"
      print_info "from the Docker network at ${pg_host}:${pg_port}"
    fi
  else
    db_url="file:/data/ollama-admin.db"
    print_ok "Using SQLite (stored in Docker volume)"
  fi

  # ---- Step 3: Configure options ------------------------------------------

  print_step 3 "Configuration"

  local ollama_url port
  printf "\n"

  ollama_url=$(prompt_input "Ollama server URL" "http://host.docker.internal:11434")
  port=$(prompt_input "Ollama Admin port" "3000")

  local nextauth_secret
  nextauth_secret=$(generate_secret)
  print_ok "Generated secure auth secret"

  # GPU Agent
  printf "\n"
  print_info "Enable GPU monitoring agent?"
  printf "\n"
  local gpu_choice
  gpu_choice=$(prompt_choice "GPU Agent" \
    "No (skip GPU monitoring)" \
    "Yes, NVIDIA GPU" \
    "Yes, AMD GPU" \
    "Yes, Intel GPU" \
    "Yes, Apple Silicon (macOS)")

  local gpu_enabled=false
  local gpu_backend="auto"
  case $gpu_choice in
    1) gpu_enabled=true; gpu_backend="nvidia" ;;
    2) gpu_enabled=true; gpu_backend="amd" ;;
    3) gpu_enabled=true; gpu_backend="intel" ;;
    4) gpu_enabled=true; gpu_backend="apple" ;;
  esac

  # ---- Step 4: Generate files & deploy ------------------------------------

  print_step 4 "Deploying"

  # Create install directory
  mkdir -p "$INSTALL_DIR"
  print_ok "Created $INSTALL_DIR"

  # Generate .env
  cat > "$ENV_FILE" <<ENVEOF
# Ollama Admin — Generated by installer
# $(date -u +%Y-%m-%dT%H:%M:%SZ)

DATABASE_URL="${db_url}"
DEFAULT_OLLAMA_URL="${ollama_url}"
NEXTAUTH_SECRET="${nextauth_secret}"
NEXTAUTH_URL="http://localhost:${port}"
LOG_RETENTION_DAYS=90
LOG_STORE_PROMPTS=true
CATALOG_REFRESH_ENABLED=true
CATALOG_RATE_LIMIT_MS=2000
GPU_AGENT_ENABLED=${gpu_enabled}
GPU_BACKEND=${gpu_backend}
ENVEOF
  print_ok "Generated .env"

  # Generate docker-compose.yml
  cat > "$COMPOSE_FILE" <<COMPOSEEOF
version: "3.9"

services:
  ollama-admin:
    image: ghcr.io/ollama-admin/ollama-admin:${VERSION}
    ports:
      - "${port}:3000"
    env_file: .env
    environment:
      PORT: "3000"
COMPOSEEOF

  # Add volumes
  if [ "$use_postgres" = false ]; then
    cat >> "$COMPOSE_FILE" <<COMPOSEEOF
    volumes:
      - ollama-admin-data:/data
COMPOSEEOF
  fi

  cat >> "$COMPOSE_FILE" <<COMPOSEEOF
    restart: unless-stopped
COMPOSEEOF

  # Add GPU Agent if enabled
  if [ "$gpu_enabled" = true ]; then
    cat >> "$COMPOSE_FILE" <<COMPOSEEOF

  gpu-agent:
    image: ghcr.io/ollama-admin/ollama-admin-gpu-agent:${VERSION}
COMPOSEEOF

    if [ "$gpu_backend" = "nvidia" ]; then
      cat >> "$COMPOSE_FILE" <<COMPOSEEOF
    runtime: nvidia
    environment:
      NVIDIA_VISIBLE_DEVICES: all
      GPU_BACKEND: nvidia
COMPOSEEOF
    elif [ "$gpu_backend" = "amd" ]; then
      cat >> "$COMPOSE_FILE" <<COMPOSEEOF
    devices:
      - /dev/kfd:/dev/kfd
      - /dev/dri:/dev/dri
    environment:
      GPU_BACKEND: amd
COMPOSEEOF
    else
      cat >> "$COMPOSE_FILE" <<COMPOSEEOF
    environment:
      GPU_BACKEND: ${gpu_backend}
COMPOSEEOF
    fi

    cat >> "$COMPOSE_FILE" <<COMPOSEEOF
    ports:
      - "11435:11435"
    restart: unless-stopped
COMPOSEEOF
  fi

  # Add volumes section
  if [ "$use_postgres" = false ]; then
    cat >> "$COMPOSE_FILE" <<COMPOSEEOF

volumes:
  ollama-admin-data:
COMPOSEEOF
  fi

  print_ok "Generated docker-compose.yml"

  # Pull and start
  printf "\n"
  (cd "$INSTALL_DIR" && docker compose pull 2>&1) &
  spin $! "Pulling Docker images..."
  if [ $? -eq 0 ]; then
    print_ok "Images pulled"
  else
    print_fail "Failed to pull images. Check your internet connection."
    print_info "You can retry manually: cd $INSTALL_DIR && docker compose pull"
    exit 1
  fi

  (cd "$INSTALL_DIR" && docker compose up -d 2>&1) &
  spin $! "Starting services..."
  if [ $? -eq 0 ]; then
    print_ok "Services started"
  else
    print_fail "Failed to start services"
    print_info "Check logs: cd $INSTALL_DIR && docker compose logs"
    exit 1
  fi

  # Wait for health check
  printf "\n"
  local retries=0
  local max_retries=30
  while [ $retries -lt $max_retries ]; do
    if curl -sf "http://localhost:${port}/api/health" &>/dev/null; then
      break
    fi
    retries=$((retries + 1))
    printf "\r  ${CYAN}$(printf '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏' | cut -c$((retries % 10 + 1)))${NC} Waiting for Ollama Admin to start... (${retries}/${max_retries})"
    sleep 1
  done

  if [ $retries -lt $max_retries ]; then
    printf "\r"
    print_ok "Ollama Admin is running"
  else
    printf "\r"
    print_warn "Ollama Admin hasn't responded yet. It may still be starting."
    print_info "Check status: cd $INSTALL_DIR && docker compose logs -f"
  fi

  # ---- Step 5: Done -------------------------------------------------------

  print_step 5 "Installation complete"

  local access_url="http://localhost:${port}"

  printf "\n"
  printf "  ${GREEN}${BOLD}+--------------------------------------------------+${NC}\n"
  printf "  ${GREEN}${BOLD}|${NC}                                                  ${GREEN}${BOLD}|${NC}\n"
  printf "  ${GREEN}${BOLD}|${NC}   ${BOLD}Ollama Admin is ready!${NC}                        ${GREEN}${BOLD}|${NC}\n"
  printf "  ${GREEN}${BOLD}|${NC}                                                  ${GREEN}${BOLD}|${NC}\n"
  printf "  ${GREEN}${BOLD}|${NC}   ${CYAN}%-48s${NC} ${GREEN}${BOLD}|${NC}\n" "$access_url"
  printf "  ${GREEN}${BOLD}|${NC}                                                  ${GREEN}${BOLD}|${NC}\n"
  printf "  ${GREEN}${BOLD}|${NC}   Open the URL above to start the setup wizard   ${GREEN}${BOLD}|${NC}\n"
  printf "  ${GREEN}${BOLD}|${NC}                                                  ${GREEN}${BOLD}|${NC}\n"
  printf "  ${GREEN}${BOLD}+--------------------------------------------------+${NC}\n"

  printf "\n"
  printf "  ${DIM}Useful commands:${NC}\n"
  printf "  ${DIM}  cd $INSTALL_DIR${NC}\n"
  printf "  ${DIM}  docker compose logs -f     ${NC}${DIM}# View logs${NC}\n"
  printf "  ${DIM}  docker compose restart     ${NC}${DIM}# Restart${NC}\n"
  printf "  ${DIM}  docker compose down        ${NC}${DIM}# Stop${NC}\n"
  printf "  ${DIM}  docker compose pull && docker compose up -d  ${NC}${DIM}# Update${NC}\n"
  printf "\n"
}

main "$@"
