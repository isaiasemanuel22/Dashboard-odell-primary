#!/usr/bin/env bash
# Crea la app Heroku (cuenta nueva), configura JawsDB + Firebase, despliega y sincroniza Prisma.
# Requisito: cuenta Heroku verificada (https://heroku.com/verify)
#
# Uso:
#   npm run heroku:setup
#   APP=mi-app npm run heroku:setup
#   CORS_ORIGINS=https://mi-sitio.netlify.app,http://localhost:4200 npm run heroku:setup
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REQUESTED_APP="${APP:-odell-dashboard-api}"
REGION="${REGION:-us}"
FIREBASE_JSON="${FIREBASE_JSON:-$ROOT/backend/firebase-service-account.json}"
CORS_ORIGINS="${CORS_ORIGINS:-https://dashboard-odell-2.web.app,http://localhost:4200}"
JAWSDB_PLAN="${JAWSDB_PLAN:-jawsdb:kitefin}"

echo "==> Heroku account"
heroku auth:whoami

resolve_app_name() {
  if heroku apps:info -a "$1" &>/dev/null; then
    echo "$1"
    return
  fi
  echo ""
}

APP="$(resolve_app_name "$REQUESTED_APP")"

if [[ -z "$APP" ]]; then
  echo "==> Creating Heroku app (requested name: $REQUESTED_APP)..."
  if heroku create "$REQUESTED_APP" --region "$REGION" 2>/tmp/heroku-create.err; then
    APP="$REQUESTED_APP"
  else
    cat /tmp/heroku-create.err >&2
    echo "==> Name taken or create failed; creating with random name..." >&2
    CREATE_OUT="$(heroku create --region "$REGION")"
    APP="$(echo "$CREATE_OUT" | sed -n 's|^https://\([^.]*\)\.herokuapp\.com.*|\1|p')"
  fi
fi

if [[ -z "$APP" ]]; then
  echo "Could not resolve Heroku app name." >&2
  exit 1
fi

echo "==> Using app: $APP"

echo "==> Git remote heroku"
git remote remove heroku 2>/dev/null || true
heroku git:remote -a "$APP"

echo "==> JawsDB MySQL"
if ! heroku config:get DATABASE_URL -a "$APP" 2>/dev/null | grep -qE '^mysql'; then
  heroku addons:create "$JAWSDB_PLAN" -a "$APP" || {
    echo "Plan $JAWSDB_PLAN unavailable; trying jawsdb:leopard..." >&2
    heroku addons:create jawsdb:leopard -a "$APP"
  }
fi

echo "==> Config vars"
if [[ ! -f "$FIREBASE_JSON" ]]; then
  echo "Missing Firebase service account: $FIREBASE_JSON" >&2
  exit 1
fi

FIREBASE_SERVICE_ACCOUNT_JSON="$(node -e "console.log(JSON.stringify(require(process.argv[1])))" "$FIREBASE_JSON")"

heroku config:set \
  NODE_ENV=production \
  REQUIRE_DATABASE=true \
  REQUIRE_AUTH=true \
  FIREBASE_STORAGE_BUCKET=dashboard-odell-2.firebasestorage.app \
  "CORS_ORIGINS=$CORS_ORIGINS" \
  -a "$APP"

# Evita límites de shell con JSON largo
printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" | heroku config:set FIREBASE_SERVICE_ACCOUNT_JSON=- -a "$APP"

echo "==> Deploy (git push heroku main)"
git push heroku main

echo "==> Prisma db push on Heroku"
APP="$APP" npm run db:push:heroku

WEB_URL="$(heroku info -s -a "$APP" | sed -n 's/^web_url=//p')"
echo ""
echo "Listo."
echo "  App:     $APP"
echo "  API:     ${WEB_URL}api/health"
echo ""
echo "Actualizá el frontend con:"
echo "  export API_URL=${WEB_URL}api"
echo "  npm run frontend:deploy"
