# Chat-bot

Проект разделен на два независимых контура:

- Linux server: `SERVER_MODE=metrics`, сбор метрик и постановка задач в Google Sheet.
- Windows PC: `LOCAL_MODE=sender`, локальная отправка Telegram через Telethon и VPN на ПК.

Источник истины между контурами: Google Sheet `Рассылка отчетов`.

```text
1OdgpoZiwyAkwnOxRtgr5bFx8WyN2RbO83Fwjss0pUrg
```

## Архитектура

Серверный контур не отправляет Telegram и не инициализирует Telethon. Он должен писать задачи в лист `Рассылка` со статусом `pending`.

Локальный контур на Windows читает `pending`, ставит строку в `processing`, отправляет через Telethon, затем обновляет строку как `sent` или `failed` и пишет запись в `Лог отправок`.

## Google Sheet Contract

Обязательные колонки листа `Рассылка`:

```text
sending_id | shop_id | sender_alias | recipient_id | recipient_contact | mailing_variant | send_at | timezone | status | dry_run | message_text | last_error | sent_at | telegram_message_id | attempts | comment
```

Статусы:

- `pending` - задача готова к локальной отправке.
- `processing` - локальный sender взял строку в работу.
- `sent` - сообщение отправлено или dry-run успешно обработан.
- `failed` - отправка завершилась ошибкой.

Правила обработки:

- Сервер создает или обновляет задачи только как `pending`.
- Локальный sender обрабатывает только `pending`.
- Перед отправкой sender меняет статус на `processing` и увеличивает `attempts` на `1`.
- После успеха sender пишет `status=sent`, `sent_at`, `telegram_message_id`, очищает `last_error`.
- После ошибки sender пишет `status=failed`, `last_error`, оставляет `telegram_message_id` пустым.
- Каждая попытка пишет строку в `Лог отправок`.
- Повторная отправка предотвращается локальным lock-файлом и переходом `pending -> processing`.

Если `message_text` пустой, локальный sender формирует базовый текст из `sending_id`, `shop_id`, `mailing_variant`.

## Windows Local Sender

Подготовка:

```powershell
cd C:\Dev\Chat-bot
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Создайте локальный файл `.env.local` по примеру `deploy/local.sender.env.example`. Не коммитьте реальные секреты.

Минимальные переменные:

```text
LOCAL_MODE=sender
CHAT_BOT_SPREADSHEET_ID=1OdgpoZiwyAkwnOxRtgr5bFx8WyN2RbO83Fwjss0pUrg
GOOGLE_SERVICE_ACCOUNT_FILE=C:\secure\google-service-account.json
TELEGRAM_API_ID=25823233
TELEGRAM_API_HASH=<secret>
TELEGRAM_SESSIONS_DIR=C:\Dev\Chat-bot\sessions
DEFAULT_SENDER_ALIAS=seller_main
```

Запуск вручную:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Dev\Chat-bot\scripts\run_local_sender.ps1
```

Логи:

```text
C:\Dev\Chat-bot\logs\sender.log
```

Планировщик Windows:

```powershell
schtasks /Create /TN ChatBotLocalSender /SC MINUTE /MO 5 /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Dev\Chat-bot\scripts\run_local_sender.ps1"
schtasks /Run /TN ChatBotLocalSender
schtasks /Query /TN ChatBotLocalSender /V /FO LIST
```

Удаление задачи:

```powershell
schtasks /Delete /TN ChatBotLocalSender /F
```

## Local Telegram

Создание локальной session:

```powershell
cd C:\Dev\Chat-bot
$env:LOCAL_MODE="sender"
$env:TELEGRAM_API_ID="25823233"
$env:TELEGRAM_API_HASH="<secret>"
$env:TELEGRAM_SESSIONS_DIR="C:\Dev\Chat-bot\sessions"
.\.venv\Scripts\python.exe scripts\telegram_login.py --sender-alias seller_main --phone +79362262038
```

Smoke-test подключения:

```powershell
$env:LOCAL_MODE="sender"
.\.venv\Scripts\python.exe scripts\telegram_connect_smoke.py --timeout-sec 20
```

Опциональный SOCKS5:

```powershell
$env:TG_PROXY_TYPE="socks5"
$env:TG_PROXY_HOST="<host>"
$env:TG_PROXY_PORT="<port>"
```

## Linux Server Metrics

Сервер запускается только в режиме:

```bash
SERVER_MODE=metrics
```

Проверка metrics-only:

```bash
cd ~/Chat_Bot
SERVER_MODE=metrics bash scripts/run_server_metrics.sh --check-only
```

Создание тестовой pending-задачи, если настроен доступ к Google Sheet:

```bash
cd ~/Chat_Bot
SERVER_MODE=metrics METRICS_RECIPIENT_CONTACT="@recipient" bash scripts/run_server_metrics.sh --create-test-task
```

Серверу не нужны `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSIONS_DIR`.

## Troubleshooting

- VPN выключен на ПК: `telegram_connect_smoke.py` или sender даст network timeout.
- Нет доступа к Google Sheet: проверьте `GOOGLE_SERVICE_ACCOUNT_FILE` или `GOOGLE_SERVICE_ACCOUNT_JSON` и права service account на таблицу.
- Lock-файл: если sender уже запущен, второй запуск пишет `LOCKED` в `logs\sender.log`.
- Нет session: запустите `scripts\telegram_login.py` локально в `LOCAL_MODE=sender`.
- Сервер пытается отправлять Telegram: это ошибка конфигурации; на сервере должен быть только `SERVER_MODE=metrics`.

## Optional Tools

`scripts/manage_google_sheet.py` остается optional legacy/local tool для ручной работы через service account. Основное управление структурой таблицы во время разработки можно делать через Codex Google Drive plugin.
