#!/bin/sh
set -e

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [INFO] Ollama Admin starting..."

# Detect database type from DATABASE_URL and set Prisma provider accordingly
PRISMA_BIN="node_modules/prisma/build/index.js"

if echo "$DATABASE_URL" | grep -q "^postgresql"; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [INFO] Detected PostgreSQL database"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
  node "$PRISMA_BIN" generate 2>/dev/null || true
else
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [INFO] Using SQLite database"
fi

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [INFO] Running database migrations..."
node "$PRISMA_BIN" migrate deploy || node "$PRISMA_BIN" db push --skip-generate || true
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [INFO] Database ready"

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [INFO] Starting Next.js server on port ${PORT:-3000}"
exec "$@"
