#!/bin/sh
set -e

npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate 2>/dev/null || true

exec "$@"
