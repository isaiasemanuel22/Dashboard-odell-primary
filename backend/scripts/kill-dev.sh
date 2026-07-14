#!/usr/bin/env bash
# Detiene instancias del API de este proyecto (nest watch + node dist + puerto).
# No matar "npm run start:dev": ese es el proceso que invoca este script.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"

# Servidor Nest compilado
pkill -f "${ROOT}/dist/src/main" 2>/dev/null || true
pkill -f "${ROOT}/dist/main" 2>/dev/null || true

# Watcher de nest de ESTE proyecto (no el npm que llama a kill:dev)
pkill -f "${ROOT}/node_modules/.bin/nest start" 2>/dev/null || true

if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti:"${PORT}" 2>/dev/null || true)"
  if [ -n "${PIDS}" ]; then
    kill -9 ${PIDS} 2>/dev/null || true
  fi
fi

echo "Procesos del backend detenidos (puerto ${PORT})."
