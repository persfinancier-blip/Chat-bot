import type { FastifyInstance } from "fastify";
import type { DashboardDb } from "../db/database.js";
import type { MonitoringService } from "../services/monitoringService.js";
import { computeHealthScore } from "../services/alerts.js";

export const registerApiRoutes = async (
  app: FastifyInstance,
  deps: { db: DashboardDb; monitor: MonitoringService }
) => {
  const { db, monitor } = deps;

  app.get("/api/health", async () => {
    const alerts = db.activeAlerts();
    return {
      ok: true,
      healthScore: computeHealthScore(alerts),
      collector: monitor.latest()?.mode ?? "booting",
      collectedAt: monitor.latest()?.collectedAt
    };
  });

  app.post("/api/collect", async () => {
    const snapshot = await monitor.collectOnce();
    return { ok: true, collectedAt: snapshot.collectedAt, mode: snapshot.mode };
  });

  app.get("/api/overview", async () => {
    const jobs = db.latestJobs();
    const workers = db.latestWorkers();
    const logs = db.latestLogs();
    const alerts = db.activeAlerts();
    const metrics = db.metricsHistory(1).at(-1);
    return {
      collectedAt: monitor.latest()?.collectedAt,
      collectorMode: monitor.latest()?.mode,
      healthScore: computeHealthScore(alerts),
      kpis: {
        jobsTotal: jobs.length,
        jobsCritical: jobs.filter((j) => j.status === "failed" || j.status === "stuck").length,
        workersTotal: workers.length,
        workersCritical: workers.filter((w) => w.status === "crit").length,
        logsTotal: logs.length,
        staleLogs: logs.filter((l) => l.stale).length,
        activeAlerts: alerts.length
      },
      metrics,
      alerts: alerts.slice(0, 12)
    };
  });

  app.get("/api/jobs", async () => ({ jobs: db.latestJobs() }));
  app.get("/api/workers", async () => ({ workers: db.latestWorkers() }));
  app.get("/api/logs", async () => ({ logs: db.latestLogs() }));
  app.get("/api/alerts", async () => ({ alerts: db.activeAlerts() }));
  app.get("/api/metrics", async (request) => {
    const limit = Number((request.query as { limit?: string }).limit || 120);
    return { metrics: db.metricsHistory(Math.min(Math.max(limit, 1), 500)) };
  });
};
