#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${HOME}/Chat_Bot"
SESSIONS_DIR="${APP_DIR}/sessions"

mkdir -p "$SESSIONS_DIR"
chmod 700 "$SESSIONS_DIR"

cd "$APP_DIR"
export PYTHONPATH="${APP_DIR}/vendor:${PYTHONPATH:-}"

if python3 - <<'PY' >/dev/null 2>&1
import telethon
PY
then
  echo "TELETHON_READY"
elif ! python3 -m pip --version >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y python3-pip
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 --version >/dev/null
  elif python3 -m ensurepip --user >/dev/null 2>&1; then
    python3 -m pip --version >/dev/null
  else
    echo "ERROR: pip is not available. Install python3-pip on the server." >&2
    exit 1
  fi

  python3 -m pip install -r requirements.txt || python3 -m pip install --user -r requirements.txt
else
  python3 -m pip install -r requirements.txt || python3 -m pip install --user -r requirements.txt
fi

python3 - <<'PY'
import telethon
print("TELETHON_IMPORT_OK")
PY

echo "TELEGRAM_SERVER_READY"
