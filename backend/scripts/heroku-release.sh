#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set; skipping prisma db push"
  exit 0
fi

append_query_param() {
  local url="$1"
  local param="$2"
  if [[ "$url" == *"${param}"* ]]; then
    printf '%s' "$url"
  elif [[ "$url" == *"?"* ]]; then
    printf '%s&%s' "$url" "$param"
  else
    printf '%s?%s' "$url" "$param"
  fi
}

export DATABASE_URL="$(append_query_param "$DATABASE_URL" "connection_limit=1")"

for attempt in 1 2 3 4 5; do
  echo "prisma db push attempt ${attempt}/5"
  if npx prisma db push; then
    exit 0
  fi
  echo "retrying in 10s..."
  sleep 10
done

echo "prisma db push failed after retries"
exit 1
