# Deploy

This repository uses the same deployment shape as `ai-orchestrator`: build an artifact directory, then publish it to the server over SSH.

## Target

- `SERVER_HOST=155.212.162.184`
- `SERVER_USER=sourcecraft`
- `SERVER_PORT=22`
- `WEB_ROOT=/sourcecraft.dev/app/chat-bot`
- default artifact directory: `dist`

## GitHub Actions secrets

Automatic deploy on push to `main` uses:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PORT`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`

Manual deploy (`Deploy Site`) uses:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PORT`
- `SSH_PRIVATE_KEY`
- `WEB_ROOT`

Optional secrets:

- `CHAT_BOT_SERVICE_NAME` - systemd service to restart after upload, for example `chat_bot`
- `CHAT_BOT_HEALTHCHECK_URL` - URL checked after deploy

## Local deploy

Create `deploy/server.env` from `deploy/server.env.example`, then export the variables in your shell and run:

```bash
./scripts/build_bot.sh
CONFIRM_DEPLOY=YES \
SERVER_HOST=155.212.162.184 \
SERVER_USER=sourcecraft \
SERVER_PORT=22 \
WEB_ROOT=/sourcecraft.dev/app/chat-bot \
SSH_PRIVATE_KEY_PATH=/path/to/server/key \
./scripts/publish_to_server.sh
```

The publish script verifies that the target directory is writable, uploads `dist` via tar-over-ssh, and checks that `index.html` exists on the server.

## Database

If the bot needs PostgreSQL, configure either `DATABASE_URL` in the application layer or the standard variables:

- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`

The deployment scripts do not print or persist database secrets.
