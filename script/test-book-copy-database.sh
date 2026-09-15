#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${NEON_DATABASE_URL:-}" ]]; then
  echo "NEON_DATABASE_URL must point to an isolated PostgreSQL database for this validation." >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" && "$NEON_DATABASE_URL" == "$DATABASE_URL" ]]; then
  echo "Refusing to run destructive PostgreSQL validation against DATABASE_URL." >&2
  exit 1
fi

exec npx vitest run server/book-copy-database.test.ts