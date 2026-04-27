#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-${HOME}/Chat_Bot}"

cd "$APP_DIR"
export SERVER_MODE="${SERVER_MODE:-metrics}"
unset LOCAL_MODE
export PYTHONPATH="${APP_DIR}/vendor:${PYTHONPATH:-}"

python3 scripts/server_metrics_worker.py "$@"
