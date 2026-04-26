# Chat-bot

Deployment files are prepared for GitHub Actions and local SSH publishing.

- Automatic workflow: `.github/workflows/deploy.yml`
- Manual workflow: `.github/workflows/deploy-site.yml`
- Local build: `scripts/build_bot.sh`
- Local publish: `scripts/publish_to_server.sh`
- Deployment notes: `DEPLOY.md`

## Google Sheet Control

The bot control spreadsheet is:

```text
1OdgpoZiwyAkwnOxRtgr5bFx8WyN2RbO83Fwjss0pUrg
```

Required sheets:

- `Описание`: `Ссылка`, `Тип`, `Название`, `Описание`
- `Конфигурация`: `ID магазина`, `Сессия отправителя`, `Получатель`, `Название рассылки`
- `Рассылка`: `ID магазина`, `Выручка вчера`, `Выручка позавчера`, `Динамика выручки`, `ДРР вчера`, `ДРР позавчера`, `Динамика ДРР`

Setup:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
$env:GOOGLE_SERVICE_ACCOUNT_FILE = 'C:\secure\google-service-account.json'
.\.venv\Scripts\python scripts\manage_google_sheet.py init --with-default-description
```

Examples:

```powershell
.\.venv\Scripts\python scripts\manage_google_sheet.py add-sheet --title "Тест"
.\.venv\Scripts\python scripts\manage_google_sheet.py append-row --sheet "Конфигурация" --values "123|session_name|recipient|daily_report"
.\.venv\Scripts\python scripts\manage_google_sheet.py set-cell --sheet "Рассылка" --cell B2 --value "100000"
.\.venv\Scripts\python scripts\manage_google_sheet.py delete-sheet --title "Тест"
```
