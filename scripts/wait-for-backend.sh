#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
URL="http://127.0.0.1:${PORT}/api/health"
MAX_ATTEMPTS=120

echo "Esperando backend en ${URL}..."

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  if curl -sf "$URL" >/dev/null 2>&1; then
    echo "Backend listo."
    exit 0
  fi
  sleep 0.5
done

echo "Timeout: el backend no respondió en $((MAX_ATTEMPTS / 2)) segundos." >&2
exit 1
