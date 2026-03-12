#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Ollama Admin — Offline Bundle Creator
# Run this on a machine WITH internet access to create a portable bundle
# for installing on air-gapped or restricted servers.
#
# Usage:
#   bash scripts/bundle.sh [--version <tag>] [--with-gpu-agent] [--gpu-backend nvidia|amd] [--output <path>]
#
# Examples:
#   bash scripts/bundle.sh
#   bash scripts/bundle.sh --version 0.11.0 --with-gpu-agent --output /tmp/bundle.tar.gz
# ─────────────────────────────────────────────

APP_IMAGE="ghcr.io/ollama-admin/ollama-admin"
GPU_IMAGE="ghcr.io/ollama-admin/ollama-admin-gpu-agent"

VERSION="latest"
WITH_GPU_AGENT=false
GPU_BACKEND="nvidia"
OUTPUT=""

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
    --version)       VERSION="$2";     shift 2 ;;
    --with-gpu-agent) WITH_GPU_AGENT=true; shift ;;
    --gpu-backend)   GPU_BACKEND="$2"; shift 2 ;;
    --output)        OUTPUT="$2";      shift 2 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

[[ "$GPU_BACKEND" =~ ^(nvidia|amd)$ ]] || fail "--gpu-backend must be 'nvidia' or 'amd'"

BUNDLE_NAME="ollama-admin-bundle-${VERSION}"
OUTPUT="${OUTPUT:-$(pwd)/${BUNDLE_NAME}.tar.gz}"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Ollama Admin — Bundle Creator      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Preflight ──
command -v docker >/dev/null 2>&1 || fail "Docker is not installed."
docker info >/dev/null 2>&1       || fail "Docker daemon is not running."
ok "Docker detected"

# ── Working directory ──
TMPDIR_BUNDLE=$(mktemp -d)
trap 'rm -rf "$TMPDIR_BUNDLE"' EXIT
BUNDLE_DIR="${TMPDIR_BUNDLE}/${BUNDLE_NAME}"
mkdir -p "$BUNDLE_DIR"

# ── Pull and save main app image ──
info "Pulling ${APP_IMAGE}:${VERSION} ..."
docker pull "${APP_IMAGE}:${VERSION}"

info "Saving main app image ..."
docker save "${APP_IMAGE}:${VERSION}" | gzip > "${BUNDLE_DIR}/ollama-admin.tar.gz"
ok "Main app image saved"

# ── Pull and save GPU agent image (optional) ──
if $WITH_GPU_AGENT; then
  info "Pulling ${GPU_IMAGE}:${VERSION} ..."
  docker pull "${GPU_IMAGE}:${VERSION}"

  info "Saving GPU agent image ..."
  docker save "${GPU_IMAGE}:${VERSION}" | gzip > "${BUNDLE_DIR}/ollama-admin-gpu-agent.tar.gz"
  ok "GPU agent image saved"
fi

# ── Copy install-offline.sh into bundle ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/install-offline.sh" ]]; then
  cp "${SCRIPT_DIR}/install-offline.sh" "${BUNDLE_DIR}/install-offline.sh"
  chmod +x "${BUNDLE_DIR}/install-offline.sh"
  ok "install-offline.sh included"
else
  warn "install-offline.sh not found in ${SCRIPT_DIR} — bundle will not include it"
fi

# ── Write META file ──
cat > "${BUNDLE_DIR}/META" <<META
version=${VERSION}
created=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
app_image=${APP_IMAGE}:${VERSION}
gpu_agent_image=$(if $WITH_GPU_AGENT; then echo "${GPU_IMAGE}:${VERSION}"; else echo ""; fi)
gpu_backend=${GPU_BACKEND}
META

ok "META written"

# ── Create tar.gz bundle ──
info "Creating bundle: ${OUTPUT} ..."
tar -czf "$OUTPUT" -C "$TMPDIR_BUNDLE" "$BUNDLE_NAME"

# ── Summary ──
BUNDLE_SIZE=$(du -sh "$OUTPUT" | cut -f1)
BUNDLE_CHECKSUM=$(sha256sum "$OUTPUT" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$OUTPUT" | cut -d' ' -f1)

echo ""
echo -e "${GREEN}${BOLD}✔ Bundle created successfully!${NC}"
echo ""
echo -e "  ${BOLD}File:${NC}      ${OUTPUT}"
echo -e "  ${BOLD}Size:${NC}      ${BUNDLE_SIZE}"
echo -e "  ${BOLD}SHA256:${NC}    ${BUNDLE_CHECKSUM}"
echo -e "  ${BOLD}Version:${NC}   ${VERSION}"
if $WITH_GPU_AGENT; then
  echo -e "  ${BOLD}GPU:${NC}       ${GPU_BACKEND}"
fi
echo ""
echo -e "  ${CYAN}Next step — transfer to your server and run:${NC}"
echo -e "  ${BOLD}bash install-offline.sh --bundle ${OUTPUT##*/}${NC}"
if $WITH_GPU_AGENT; then
  echo -e "  ${BOLD}bash install-offline.sh --bundle ${OUTPUT##*/} --with-gpu-agent --gpu-backend ${GPU_BACKEND}${NC}"
fi
echo ""
