#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTML="$DIR/manual-odell.html"
PDF="$DIR/Manual-Odell-Dashboard.pdf"

CHROME=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROME="$candidate"
    break
  fi
done

if [[ -z "$CHROME" ]]; then
  echo "Error: no se encontró Chrome/Chromium para generar el PDF." >&2
  exit 1
fi

if [[ ! -f "$HTML" ]]; then
  echo "Error: no existe $HTML" >&2
  exit 1
fi

"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=10000 \
  --print-to-pdf="$PDF" \
  "file://$HTML"

echo "PDF generado: $PDF"
