#!/usr/bin/env bash
set -euo pipefail

# JawsDB free tier allows 10 connections; the web dyno can use them all.
# Run db push with web scaled to 0 so the release/deploy is not blocked.
#
# Por defecto NO usa --accept-data-loss (puede vaciar tablas).
# Solo si hace falta un cambio destructivo:
#   ACCEPT_DATA_LOSS=1 npm run db:push:heroku
APP="${APP:-odell-dashboard-api}"
PRISMA_VERSION="${PRISMA_VERSION:-7.8.0}"

scale_web_up() {
  echo "Scaling web back to 1 on ${APP}..."
  heroku ps:scale web=1 --app "$APP"
}

trap scale_web_up EXIT

PUSH_FLAGS=()
if [[ "${ACCEPT_DATA_LOSS:-}" == "1" ]]; then
  echo "WARNING: ACCEPT_DATA_LOSS=1 — Prisma puede borrar columnas/tablas."
  PUSH_FLAGS+=(--accept-data-loss)
else
  echo "Running prisma db push without --accept-data-loss (safe default)."
fi

echo "Scaling web to 0 on ${APP}..."
heroku ps:scale web=0 --app "$APP"

echo "Running prisma db push in backend/..."
heroku run "cd backend && npx --yes prisma@${PRISMA_VERSION} db push ${PUSH_FLAGS[*]-}" --app "$APP"

trap - EXIT
scale_web_up

echo "Done."
