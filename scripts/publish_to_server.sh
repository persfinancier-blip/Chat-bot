#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   CONFIRM_DEPLOY=YES SERVER_HOST=155.212.162.184 SERVER_USER=sourcecraft SERVER_PORT=22 WEB_ROOT=/sourcecraft.dev/app/chat-bot ./scripts/publish_to_server.sh
#
# Optional:
#   DEPLOY_DIR=dist
#   VERIFY_FILE=index.html
#   SSH_PRIVATE_KEY_PATH=/path/to/private/key
#   SERVICE_NAME=chat_bot
#   HEALTHCHECK_URL=http://155.212.162.184/

CONFIRM_DEPLOY="${CONFIRM_DEPLOY:-}"
SERVER_HOST="${SERVER_HOST:-}"
SERVER_USER="${SERVER_USER:-sourcecraft}"
SERVER_PORT="${SERVER_PORT:-22}"
WEB_ROOT="${WEB_ROOT:-/sourcecraft.dev/app/chat-bot}"
DEPLOY_DIR="${DEPLOY_DIR:-dist}"
VERIFY_FILE="${VERIFY_FILE:-index.html}"
SSH_PRIVATE_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-}"
SERVICE_NAME="${SERVICE_NAME:-}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"

if [[ "$CONFIRM_DEPLOY" != "YES" ]]; then
  echo "ERROR: set CONFIRM_DEPLOY=YES" >&2
  exit 1
fi

if [[ -z "$SERVER_HOST" ]]; then
  echo "ERROR: SERVER_HOST is required" >&2
  exit 1
fi

if [[ ! -d "$DEPLOY_DIR" ]]; then
  echo "ERROR: deploy directory '$DEPLOY_DIR' not found. Run scripts/build_bot.sh first." >&2
  exit 1
fi

if [[ -n "$SSH_PRIVATE_KEY_PATH" && ! -f "$SSH_PRIVATE_KEY_PATH" ]]; then
  echo "ERROR: SSH_PRIVATE_KEY_PATH does not exist: $SSH_PRIVATE_KEY_PATH" >&2
  exit 1
fi

SSH_TARGET="${SERVER_USER}@${SERVER_HOST}"
SSH_OPTS=( -p "$SERVER_PORT" -o StrictHostKeyChecking=accept-new )

if [[ -n "$SSH_PRIVATE_KEY_PATH" ]]; then
  SSH_OPTS+=( -i "$SSH_PRIVATE_KEY_PATH" -o IdentitiesOnly=yes )
fi

echo "Target server: ${SSH_TARGET}:${SERVER_PORT}"
echo "Web root: ${WEB_ROOT}"
echo "Deploy dir: ${DEPLOY_DIR}"

echo "[1/4] Ensuring target directory exists and is writable..."
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "mkdir -p '${WEB_ROOT}' && test -w '${WEB_ROOT}'"

echo "[2/4] Uploading build artifacts via tar-over-ssh..."
tar -C "$DEPLOY_DIR" -czf - . | ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "tar -xzf - -C '${WEB_ROOT}'"

echo "[3/4] Verifying deployed artifact..."
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "test -f '${WEB_ROOT}/${VERIFY_FILE}'"

if [[ -n "$SERVICE_NAME" ]]; then
  echo "[4/4] Restarting service: ${SERVICE_NAME}"
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "sudo /bin/systemctl restart '${SERVICE_NAME}'"
else
  echo "[4/4] SERVICE_NAME is not set; skipping service restart."
fi

if [[ -n "$HEALTHCHECK_URL" ]]; then
  echo "Checking health URL: ${HEALTHCHECK_URL}"
  curl -fsS "$HEALTHCHECK_URL" >/dev/null
fi

echo "Done."
