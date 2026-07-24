#!/usr/bin/env bash
set -euo pipefail

# JawsDB free tier allows 10 connections; the web dyno can use them all.
# Run db push with web scaled to 0 so the release/deploy is not blocked.
APP="${APP:-odell-dashboard-api}"

echo "Scaling web to 0 on ${APP}..."
heroku ps:scale web=0 --app "$APP"

echo "Running prisma db push..."
heroku run "cd backend && npx --yes prisma db push --accept-data-loss" --app "$APP"

echo "Scaling web back to 1..."
heroku ps:scale web=1 --app "$APP"

echo "Done."
