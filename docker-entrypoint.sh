#!/bin/sh
set -e

# Detect database type from DATABASE_URL and set Prisma provider accordingly
if echo "$DATABASE_URL" | grep -q "^postgresql"; then
  echo "Detected PostgreSQL database"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
  npx prisma generate 2>/dev/null || true
fi

npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate 2>/dev/null || true

exec "$@"
