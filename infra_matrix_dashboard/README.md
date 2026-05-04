# Infra Matrix Dashboard

MVP monitoring dashboard for the `silver_bullet` pipeline server. The app is read-only: it collects cron/systemd/log/host telemetry through SSH or local read-only commands, stores snapshots in SQLite, exposes Fastify API endpoints, and renders a React Matrix-style NOC dashboard.

## Architecture Choice

Backend: **Node.js + Fastify**.

Reason: this MVP ships as one npm workspace with the React/Vite frontend, runs easily on Windows for local operations, and supports SSH polling without requiring another Python runtime. Fastify keeps the API small and explicit.

Frontend: **React + TypeScript + Tailwind + shadcn-like local UI components + Recharts**.

Storage: **SQLite MVP through `sql.js`** in `./data/infra_matrix.sqlite`. The schema is intentionally close to the future PostgreSQL shape.

## Data Flow

```text
Fastify collector loop
  -> SSH or local read-only commands
  -> cron/systemd/log/host parsers
  -> SQLite tables
  -> /api/* endpoints
  -> React dashboards polling every 30 sec
```

Collector modes:

- `COLLECTOR_MODE=auto`: SSH when credentials are configured; local collector in `APP_ENV=prod`; mock otherwise.
- `COLLECTOR_MODE=ssh`: force SSH collector.
- `COLLECTOR_MODE=local`: force local read-only collector on the host where the app runs.
- `COLLECTOR_MODE=mock`: force seed/mock data for UI demos.

## Tables

- `job_runs`
- `worker_state`
- `log_heartbeat`
- `host_metrics`
- `alerts`

## Setup

```powershell
cd C:\Dev\Chat-bot\infra_matrix_dashboard
npm.cmd install
```

Create `.env` from `.env.example`. The committed repo contains only `.env.example`; real secrets must stay local.

```powershell
Copy-Item .env.example .env
```

Minimum local mock mode:

```text
APP_ENV=dev
COLLECTOR_MODE=auto
POLL_INTERVAL_SEC=30
LOG_STALE_THRESHOLD_MIN=10
JOB_STUCK_THRESHOLD_MIN=180
```

SSH mode:

```text
SSH_HOST=155.212.162.184
SSH_PORT=22
SSH_USER=sourcecraft
SSH_PASSWORD=
SSH_KEY_PATH=C:\Users\<you>\.ssh\chat_bot_deploy
LOGS_PATH=/projects/silver_bullet/logs
```

Use either `SSH_PASSWORD` or `SSH_KEY_PATH`. Do not commit `.env`, private keys, DB passwords, or copied logs.

## Run

```powershell
npm.cmd run dev
```

URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8787/api/health`

Manual collector run:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8787/api/collect
```

Smoke test:

```powershell
npm.cmd run smoke
```

Type/build checks:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## Server Deploy

Recommended runtime directory:

```text
/home/sourcecraft/infra_matrix_dashboard
```

Production start after copying the project:

```bash
cd /home/sourcecraft/infra_matrix_dashboard
npm ci --omit=dev
APP_ENV=prod COLLECTOR_MODE=local API_HOST=0.0.0.0 API_PORT=8791 npm start
```

Run with pm2:

```bash
cd /home/sourcecraft/infra_matrix_dashboard
pm2 start npm --name infra-matrix-dashboard -- start
pm2 save
```

If the dashboard runs on the monitored server, use `COLLECTOR_MODE=local` to avoid SSH secrets. If it runs from another host, fill `SSH_HOST`, `SSH_USER` and either `SSH_PASSWORD` or `SSH_KEY_PATH`, then use `COLLECTOR_MODE=ssh`.

On the current server, port `8787` is already used by AI Orchestrator, so Infra Matrix is expected to run on `8791` unless nginx is updated to proxy it.

## Dashboards

1. **Global Control Panel**
   - Health score
   - Active incidents
   - KPI tiles
   - Collector mode

2. **Jobs Matrix**
   - Cron/systemd timers
   - Last start/finish
   - Status: `success`, `failed`, `running`, `stuck`, `unknown`
   - Stuck rule: runtime over `JOB_STUCK_THRESHOLD_MIN`

3. **Logs Observatory**
   - Log heartbeat
   - Stale detector
   - Error signatures: `ERROR|Exception|Traceback|FATAL`
   - Top errors from latest tail

4. **Workers & Host**
   - systemd services
   - active/restarting/dead style states
   - CPU/RAM/disk/swap/load
   - Top processes

## Adding Jobs Or Services

Cron jobs are auto-discovered from systemd cron timers matching:

```text
cron-root-root-*.timer
```

Worker services are auto-discovered from units matching:

```text
wb_*.service
my_api.service
postgresql*.service
docker.service
```

To add a new known service, extend the grep expression in:

```text
backend/src/collectors/sshCollector.ts
```

## Alerts

Current criteria:

- failed job
- stuck job
- log stale
- errors in latest log tail
- service down/unhealthy
- CPU/RAM/Disk above thresholds
- SSH collector degraded

Levels:

- `info`
- `warn`
- `crit`

## API

- `GET /api/health`
- `GET /api/overview`
- `GET /api/jobs`
- `GET /api/logs`
- `GET /api/workers`
- `GET /api/metrics?limit=120`
- `GET /api/alerts`
- `POST /api/collect`

## Known Limitations

- SSH collector is read-only and depends on the SSH user permissions; local collector depends on Linux command availability and filesystem permissions.
- If `/projects/silver_bullet/logs` is not readable, logs show as collector alerts or mock data.
- The app does not yet parse exact DB table lineage. It is prepared for future table-level data quality dashboards.
- No authentication is included in MVP; run behind localhost/VPN/reverse proxy auth for production.
- SQLite is for MVP. Move to PostgreSQL when multiple operators or long retention are required.

## Future Data Quality Extension

Recommended next tables:

- `table_freshness`
- `table_counts`
- `reconciliation_checks`
- `source_target_gaps`
- `dq_rule_results`

These can reuse the existing alert model and health score.
