import type { AlertItem, AppConfig, Snapshot } from "../types/models.js";

export const buildAlerts = (snapshot: Snapshot, config: AppConfig): AlertItem[] => {
  const now = snapshot.collectedAt;
  const alerts: AlertItem[] = [];
  const push = (level: AlertItem["level"], type: string, title: string, message: string, source: string) => {
    alerts.push({
      id: `${type}:${source}:${title}`.replace(/\s+/g, "_").slice(0, 180),
      level,
      type,
      title,
      message,
      source,
      createdAt: now,
      active: true
    });
  };

  for (const err of snapshot.collectorErrors) {
    push(snapshot.mode === "mock" ? "warn" : "crit", "collector_error", "Collector degraded", err, "collector");
  }

  for (const job of snapshot.jobs) {
    if (job.status === "failed") push("crit", "failed_job", "Failed job", `${job.name} reported failed result`, job.unit);
    if (job.status === "stuck") push("crit", "stuck_job", "Stuck job", `${job.name} exceeded ${config.jobStuckThresholdMin} min`, job.unit);
    if (job.status === "unknown") push("warn", "unknown_job", "Unknown job state", `${job.name} cannot be classified`, job.unit);
  }

  for (const log of snapshot.logs) {
    if (log.stale) push("warn", "log_stale", "Log stale", `${log.fileName} has no writes within ${config.logStaleThresholdMin} min`, log.fileName);
    if (log.errorCount > 0) push(log.errorCount > 10 ? "crit" : "warn", "log_errors", "Errors in log", `${log.fileName}: ${log.errorCount} errors in tail`, log.fileName);
  }

  for (const worker of snapshot.workers) {
    if (worker.status === "crit") push("crit", "service_down", "Service unhealthy", `${worker.unit}: ${worker.activeState}/${worker.subState}`, worker.unit);
    if (worker.status === "warn") push("warn", "service_warn", "Service warning", `${worker.unit}: restarts=${worker.restarts ?? 0}`, worker.unit);
  }

  const m = snapshot.metrics;
  if (m.cpuPct >= 90) push("crit", "host_cpu", "CPU critical", `CPU ${m.cpuPct}%`, "host");
  else if (m.cpuPct >= 75) push("warn", "host_cpu", "CPU high", `CPU ${m.cpuPct}%`, "host");
  if (m.ramPct >= 90) push("crit", "host_ram", "RAM critical", `RAM ${m.ramPct}%`, "host");
  else if (m.ramPct >= 80) push("warn", "host_ram", "RAM high", `RAM ${m.ramPct}%`, "host");
  if (m.diskPct >= 90) push("crit", "host_disk", "Disk critical", `Disk ${m.diskPct}%`, "host");
  else if (m.diskPct >= 80) push("warn", "host_disk", "Disk high", `Disk ${m.diskPct}%`, "host");

  return alerts;
};

export const computeHealthScore = (alerts: AlertItem[]): number => {
  const penalty = alerts.reduce((sum, alert) => sum + (alert.level === "crit" ? 18 : alert.level === "warn" ? 7 : 2), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
};
