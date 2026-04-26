#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${HOME}/Chat_Bot"
SESSIONS_DIR="${APP_DIR}/sessions"

mkdir -p "$SESSIONS_DIR"
chmod 700 "$SESSIONS_DIR"

cd "$APP_DIR"
python3 -m pip install -r requirements.txt || python3 -m pip install --user -r requirements.txt

echo "TELEGRAM_SERVER_READY"
