#!/usr/bin/env bash
set -euo pipefail

# Builds the deployable artifact directory for Chat-bot.
# If a package.json with a build script appears later, it is used.

DEPLOY_DIR="${DEPLOY_DIR:-dist}"

rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

if [[ -f package.json ]] && command -v node >/dev/null 2>&1; then
  if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)"; then
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
    npm run build
  fi
fi

if [[ ! -f "$DEPLOY_DIR/index.html" ]]; then
  cat > "$DEPLOY_DIR/index.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Chat-bot</title>
  </head>
  <body>
    <h1>Chat-bot</h1>
    <p>Deployment artifact generated successfully.</p>
  </body>
</html>
HTML
fi

if [[ -f README.md ]]; then
  cp README.md "$DEPLOY_DIR/README.md"
fi

if [[ -f DEPLOY.md ]]; then
  cp DEPLOY.md "$DEPLOY_DIR/DEPLOY.md"
fi

if [[ -f requirements.txt ]]; then
  cp requirements.txt "$DEPLOY_DIR/requirements.txt"
fi

if [[ -d chat_bot ]]; then
  mkdir -p "$DEPLOY_DIR/chat_bot"
  cp -R chat_bot/. "$DEPLOY_DIR/chat_bot/"
fi

mkdir -p "$DEPLOY_DIR/scripts"
cp -R scripts/. "$DEPLOY_DIR/scripts/"

{
  echo "project=Chat-bot"
  echo "built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "commit=$(git rev-parse HEAD)"
  fi
} > "$DEPLOY_DIR/deploy-manifest.txt"

echo "Build artifact ready: $DEPLOY_DIR"
