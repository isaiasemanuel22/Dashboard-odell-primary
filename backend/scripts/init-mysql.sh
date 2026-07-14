#!/usr/bin/env bash
# Crea la base y el usuario de la app (requiere sudo en Ubuntu).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Falta ${ENV_FILE}. Copiá .env.example y configurá DATABASE_URL."
  exit 1
fi

DATABASE_URL="$(grep '^DATABASE_URL=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"')"
DB_PASS="$(node -e "const u=new URL(process.argv[1]); process.stdout.write(decodeURIComponent(u.password));" "${DATABASE_URL}")"
DB_USER="$(node -e "const u=new URL(process.argv[1]); process.stdout.write(decodeURIComponent(u.username));" "${DATABASE_URL}")"
DB_NAME="$(node -e "const u=new URL(process.argv[1]); process.stdout.write(u.pathname.replace(/^\\//,''));" "${DATABASE_URL}")"

sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "Base '${DB_NAME}' y usuario '${DB_USER}' listos."
