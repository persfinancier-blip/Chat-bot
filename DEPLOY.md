# Deploy

Deploy publishes the project files to Linux. The Linux side is metrics-only.

## Target

- `SERVER_HOST=155.212.162.184`
- `SERVER_USER=sourcecraft`
- `SERVER_PORT=22`
- `WEB_ROOT=/sourcecraft.dev/app/chat-bot`
- runtime copy: `~/Chat_Bot`

## Runtime Roles

Linux server:

```bash
SERVER_MODE=metrics
```

Windows PC:

```powershell
$env:LOCAL_MODE="sender"
```

The server must not run Telethon, create Telegram sessions, or send Telegram messages. Telegram sending happens only on the Windows PC through the local sender worker.

## GitHub Actions

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

Optional:

- `CHAT_BOT_SERVICE_NAME`
- `CHAT_BOT_HEALTHCHECK_URL`
- `GOOGLE_SERVICE_ACCOUNT_JSON` for future autonomous server metrics writes.

The deploy workflow uploads files and runs:

```bash
SERVER_MODE=metrics bash scripts/run_server_metrics.sh --check-only
```

This verifies that the deployed server runtime is metrics-only and does not initialize Telegram.

## Server Metrics Runner

After deploy:

```bash
cd ~/Chat_Bot
SERVER_MODE=metrics bash scripts/run_server_metrics.sh --check-only
```

To create a test pending task, configure Google Sheet access and run:

```bash
cd ~/Chat_Bot
export SERVER_MODE=metrics
export GOOGLE_SERVICE_ACCOUNT_FILE=/secure/google-service-account.json
export METRICS_RECIPIENT_CONTACT="@recipient"
bash scripts/run_server_metrics.sh --create-test-task
```

Real metrics collection should write rows to `Рассылка` with:

- `status=pending`
- `recipient_contact`
- `sender_alias`
- `message_text` or blank
- `attempts=0`
- empty `last_error`, `sent_at`, `telegram_message_id`

## Local Windows Sender

Prepare:

```powershell
cd C:\Dev\Chat-bot
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create `.env.local` from `deploy/local.sender.env.example` and fill secrets locally.

Run once:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Dev\Chat-bot\scripts\run_local_sender.ps1
```

Create scheduler:

```powershell
schtasks /Create /TN ChatBotLocalSender /SC MINUTE /MO 5 /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Dev\Chat-bot\scripts\run_local_sender.ps1"
```

Run now:

```powershell
schtasks /Run /TN ChatBotLocalSender
```

Logs:

```text
C:\Dev\Chat-bot\logs\sender.log
```

Delete scheduler:

```powershell
schtasks /Delete /TN ChatBotLocalSender /F
```

## Google Sheet Contract

`Рассылка` statuses:

- `pending`
- `processing`
- `sent`
- `failed`

`Лог отправок` receives one row per local sender attempt:

```text
log_id | sending_id | status | sender_alias | recipient_contact | message_text | error_text | telegram_message_id | created_at | comment
```

Idempotency:

- The local PowerShell wrapper uses `logs\sender.lock`.
- The queue claim changes `pending` to `processing` and increments `attempts`.
- Rows already in `processing`, `sent`, or `failed` are not picked again.

## Local Deploy

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

## Security

- Do not commit `.env.local`, service account JSON, private keys, or `.session` files.
- Do not print Telegram API hash, service account JSON, or session contents in logs.
- Keep Telegram sessions on the Windows sender machine, not on the Linux server.
