# Chat-bot

Deployment files are prepared for GitHub Actions and local SSH publishing.

- Automatic workflow: `.github/workflows/deploy.yml`
- Manual workflow: `.github/workflows/deploy-site.yml`
- Local build: `scripts/build_bot.sh`
- Local publish: `scripts/publish_to_server.sh`
- Deployment notes: `DEPLOY.md`

## Управление Google таблицей

Основной способ управления таблицей на этапе разработки:

```text
Codex -> @google-drive plugin -> Google Sheet
```

Структура таблицы создается и меняется через Codex Google Drive plugin. Service account для этого сценария не требуется.

Python-скрипт `scripts/manage_google_sheet.py` является optional legacy/local tool. Он оставлен в репозитории для локальных экспериментов и будущей автономной интеграции, но не является обязательным способом управления таблицей.

Серверный бот в будущем должен иметь отдельный runtime-доступ к таблице, если он будет работать автономно без Codex.

Таблица управления:

```text
1OdgpoZiwyAkwnOxRtgr5bFx8WyN2RbO83Fwjss0pUrg
```

Финальные листы:

- `Описание`
- `Конфигурация`
- `Отправители`
- `Получатели`
- `Шаблоны`
- `Рассылка`
- `Метрики`
- `Лог отправок`

Описание структуры: `docs/google_sheet_structure.md`.

### Optional legacy/local tool

Локальный CLI может работать через service account, если он понадобится отдельно от Codex plugin:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python scripts\manage_google_sheet.py add-sheet --title "Тест"
.\.venv\Scripts\python scripts\manage_google_sheet.py append-row --sheet "Конфигурация" --values "123|session_name|recipient|daily_report"
.\.venv\Scripts\python scripts\manage_google_sheet.py set-cell --sheet "Рассылка" --cell B2 --value "100000"
.\.venv\Scripts\python scripts\manage_google_sheet.py delete-sheet --title "Тест"
```

## Telegram sender sessions

Telegram-отправители работают через Telethon session-файлы. Session-файлы не хранятся в Git и должны находиться только на сервере:

```text
~/Chat_Bot/sessions/
```

Переменные окружения:

- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSIONS_DIR`

Первая сессия:

```text
sender_alias=seller_main
phone=+79362262038
session_file=~/Chat_Bot/sessions/seller_main.session
```

Создание сессии на сервере:

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

Связь с Google таблицей: лист `Отправители` должен содержать `sender_alias=seller_main`. Значение `sender_alias` совпадает с именем session-файла без расширения.
