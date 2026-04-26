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
- `GOOGLE_SERVICE_ACCOUNT_JSON` - optional future runtime access for the spreadsheet manager

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

## Google Sheets

The control spreadsheet ID is:

```text
1OdgpoZiwyAkwnOxRtgr5bFx8WyN2RbO83Fwjss0pUrg
```

During development, the table structure is managed by Codex through the Google Drive plugin.

The local Python spreadsheet manager is optional. If the server bot later needs autonomous spreadsheet access, configure one of:

- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_SERVICE_ACCOUNT_FILE`

The Google service account email must be shared into the spreadsheet with editor permissions before autonomous runtime access can work.

## Telegram sender sessions

Telegram-отправители работают через Telethon session-файлы. Session-файлы хранятся только на сервере:

```text
~/Chat_Bot/sessions/
```

Runtime variables:

- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSIONS_DIR`

Подготовка сервера после deploy:

```bash
cd ~/Chat_Bot
mkdir -p sessions
chmod 700 sessions
python3 -m pip install -r requirements.txt
```

Или через скрипт:

```bash
cd ~/Chat_Bot
bash scripts/prepare_server_telegram.sh
```

Первая сессия:

```text
sender_alias=seller_main
phone=+79362262038
session_file=~/Chat_Bot/sessions/seller_main.session
```

Команда на сервере:

```bash
cd ~/Chat_Bot
export TELEGRAM_API_ID="25823233"
export TELEGRAM_API_HASH="<TELEGRAM_API_HASH>"
export TELEGRAM_SESSIONS_DIR="$HOME/Chat_Bot/sessions"
python3 scripts/telegram_login.py --sender-alias seller_main --phone +79362262038
```

Проверка отправки самому себе:

```bash
cd ~/Chat_Bot
export TELEGRAM_API_ID="25823233"
export TELEGRAM_API_HASH="<TELEGRAM_API_HASH>"
export TELEGRAM_SESSIONS_DIR="$HOME/Chat_Bot/sessions"
python3 scripts/send_test_message.py --sender-alias seller_main --to me --message "test from Chat_Bot"
```

Связь с Google таблицей: лист `Отправители` должен содержать `sender_alias=seller_main`.
