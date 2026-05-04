import type { AppConfig } from "../types/models.js";
import type { Snapshot } from "../types/models.js";
import { buildAlerts } from "../services/alerts.js";

export const collectMockSnapshot = (config: AppConfig, reason = "mock mode"): Snapshot => {
  const now = new Date();
  const iso = now.toISOString();
  const jobs = [
    {
      name: "wb_orders_script.py",
      unit: "cron-root-root-0.timer",
      command: "/root/projects/silver_bullet/wb_orders_script.py",
      schedule: "2 */2 * * *",
      lastStart: new Date(now.getTime() - 22 * 60_000).toISOString(),
      lastFinish: new Date(now.getTime() - 19 * 60_000).toISOString(),
      nextExpectedRun: new Date(now.getTime() + 78 * 60_000).toISOString(),
      status: "success" as const,
      durationSec: 180,
      logFile: "script_ord.log",
      criticality: "high" as const,
      updatedAt: iso
    },
    {
      name: "wb_photo_sync_v1_3.py",
      unit: "cron-root-root-24.timer",
      command: "/root/projects/silver_bullet/wb_photo_sync_v1_3.py",
      schedule: "5 3 * * *",
      lastStart: new Date(now.getTime() - 35 * 60_000).toISOString(),
      status: "running" as const,
      durationSec: 2100,
      logFile: "script_wb_photo_sync.log",
      criticality: "medium" as const,
      updatedAt: iso
    },
    {
      name: "oz_transactions_sync.py",
      unit: "cron-root-root-23.timer",
      command: "/root/projects/silver_bullet/oz_transactions_sync.py",
      schedule: "35 5 * * *",
      lastStart: new Date(now.getTime() - 6 * 60 * 60_000).toISOString(),
      lastFinish: new Date(now.getTime() - 6 * 60 * 60_000 + 260_000).toISOString(),
      status: "failed" as const,
      durationSec: 260,
      logFile: "script_oz_transactions.log",
      criticality: "high" as const,
      updatedAt: iso
    }
  ];

  const workers = [
    { unit: "wb_worker_bids@1.service", name: "WB Bids Worker Instance 1", activeState: "active", subState: "running", status: "ok" as const, uptimeSec: 820_000, restarts: 0, lastExitCode: 0, updatedAt: iso },
    { unit: "wb_worker_budget.service", name: "WB Budget Worker", activeState: "active", subState: "running", status: "ok" as const, uptimeSec: 820_000, restarts: 1, lastExitCode: 0, updatedAt: iso },
    { unit: "wb_worker_refresher.service", name: "WB raw refresher", activeState: "inactive", subState: "dead", status: "crit" as const, uptimeSec: 0, restarts: 4, lastExitCode: 1, updatedAt: iso }
  ];

  const logs = [
    { fileName: "script_ord.log", path: `${config.logsPath}/script_ord.log`, lastWriteAt: new Date(now.getTime() - 2 * 60_000).toISOString(), sizeBytes: 120_101, totalLines: 3321, linesPerMin: 8.2, errorCount: 0, topErrors: [], stale: false, updatedAt: iso },
    { fileName: "script_oz_transactions.log", path: `${config.logsPath}/script_oz_transactions.log`, lastWriteAt: new Date(now.getTime() - 42 * 60_000).toISOString(), sizeBytes: 88_120, totalLines: 911, linesPerMin: 0, errorCount: 7, topErrors: ["ERROR timeout from Ozon API", "Traceback: requests.exceptions.ReadTimeout"], stale: true, updatedAt: iso }
  ];

  const metrics = {
    ts: iso,
    cpuPct: 37,
    ramPct: 68,
    diskPct: 74,
    swapPct: 12,
    load1: 1.72,
    load5: 1.31,
    load15: 1.04,
    topProcesses: [
      { pid: "1223149", command: "gunicorn api_server:app", cpuPct: 8.2, memPct: 4.1 },
      { pid: "2812147", command: "node /usr/local/bin/n8n", cpuPct: 5.1, memPct: 2.8 }
    ]
  };

  const alerts = buildAlerts({ collectedAt: iso, mode: "mock", jobs, workers, logs, metrics, alerts: [], collectorErrors: [reason] }, config);
  return { collectedAt: iso, mode: "mock", jobs, workers, logs, metrics, alerts, collectorErrors: [reason] };
};
