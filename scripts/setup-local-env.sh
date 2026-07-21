#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

copy_if_missing() {
  local example="$1"
  local target="$2"
  if [[ -f "$target" ]]; then
    echo "✓ Ya existe: ${target#$ROOT/}"
  else
    cp "$example" "$target"
    echo "→ Creado: ${target#$ROOT/} (desde $(basename "$example"))"
  fi
}

copy_if_missing "$ROOT/backend/.env.example" "$ROOT/backend/.env"
copy_if_missing "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"

node "$ROOT/frontend/scripts/prepare-env.mjs" development

echo ""
echo "Listo. Revisá:"
echo "  - backend/.env   (DATABASE_URL, CORS_ORIGINS)"
echo "  - frontend/.env  (API_URL=/api, API_PROXY_TARGET=http://localhost:3000)"
echo ""
echo "Arrancar:"
echo "  npm run dev:backend   # terminal 1"
echo "  npm run dev:frontend  # terminal 2"
