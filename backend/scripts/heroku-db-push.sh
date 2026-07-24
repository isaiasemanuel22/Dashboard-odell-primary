#!/usr/bin/env bash
set -euo pipefail

# JawsDB free tier allows 10 connections; the web dyno can use them all.
# Run db push with web scaled to 0 so the release/deploy is not blocked.
APP="${APP:-odell-dashboard-api}"
PRISMA_VERSION="${PRISMA_VERSION:-7.8.0}"

scale_web_up() {
  echo "Scaling web back to 1 on ${APP}..."
  heroku ps:scale web=1 --app "$APP"
}

trap scale_web_up EXIT

echo "Scaling web to 0 on ${APP}..."
heroku ps:scale web=0 --app "$APP"

echo "Running prisma db push in backend/..."
heroku run "cd backend && npx --yes prisma@${PRISMA_VERSION} db push --accept-data-loss" --app "$APP"

trap - EXIT
scale_web_up

echo "Done."
