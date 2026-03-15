#!/usr/bin/env bash
set -euo pipefail

# Deploy Models Manager static page + data export script
# Usage:
#   scripts/deploy-models-manager.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_HTML="$ROOT_DIR/web/models-manager/"
DST_HTML="/var/www/html/models-usage/"
SRC_EXPORT="$ROOT_DIR/scripts/models-usage-export.mjs"
SRC_API="$ROOT_DIR/scripts/models-save-api.mjs"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
DST_SCRIPTS="${OPENCLAW_DIR}/workspace/scripts/"
SVC_SRC="$ROOT_DIR/systemd/models-save-api.service"
SVC_DST="$HOME/.config/systemd/user/models-save-api.service"

echo "=== Deploy Models Manager ==="

# 1. Deploy static HTML
echo "1. HTML: $SRC_HTML -> $DST_HTML"
sudo mkdir -p "$DST_HTML"
sudo rsync -a --delete "$SRC_HTML" "$DST_HTML"
sudo chmod -R a+rX "$DST_HTML"
sudo chown -R www-data:www-data "$DST_HTML" || true
echo "   OK"

# 2. Scripts are already in place (same dir), no-op unless running from a clone
if [[ "$SRC_EXPORT" != "$DST_SCRIPTS/models-usage-export.mjs" ]]; then
  echo "2. Copying export script -> $DST_SCRIPTS"
  cp "$SRC_EXPORT" "$DST_SCRIPTS/models-usage-export.mjs"
  cp "$SRC_API" "$DST_SCRIPTS/models-save-api.mjs"
  echo "   OK"
else
  echo "2. Scripts already in place (same directory), skipping"
fi

# 3. Sync systemd service
echo "3. Systemd service -> $SVC_DST"
mkdir -p "$(dirname "$SVC_DST")"
cp "$SVC_SRC" "$SVC_DST"
systemctl --user daemon-reload
echo "   OK (run: systemctl --user restart models-save-api)"

echo ""
echo "Done. Reload nginx if needed: sudo nginx -s reload"
