import type { FastifyInstance } from "fastify";
import type { MonitoringService } from "../services/monitoringService.js";
import { computeHealthScore } from "../services/alerts.js";

export const registerApiRoutes = async (
  app: FastifyInstance,
  deps: { monitor: MonitoringService }
) => {
  const { monitor } = deps;

  app.get("/api/health", async () => {
    return monitor.health();
  });

  app.post("/api/collect", async () => {
    const snapshot = await monitor.collectOnce();
    return { ok: true, collectedAt: snapshot.collectedAt, mode: snapshot.mode };
  });

  app.get("/api/overview", async () => {
    const snapshot = monitor.latest();
    const jobs = snapshot?.jobs ?? [];
    const workers = snapshot?.workers ?? [];
    const logs = snapshot?.logs ?? [];
    const alerts = snapshot?.alerts ?? [];
    const metrics = snapshot?.metrics;
    const health = monitor.health();
    return {
      collectedAt: snapshot?.collectedAt,
      collectorMode: snapshot?.mode,
      connectionOk: health.connectionOk,
      degraded: health.degraded,
      reason: health.reason,
      lastSyncAt: health.lastSyncAt,
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

  app.get("/api/jobs", async () => ({ jobs: monitor.latest()?.jobs ?? [] }));
  app.get("/api/workers", async () => ({ workers: monitor.latest()?.workers ?? [] }));
  app.get("/api/logs", async () => ({ logs: monitor.latest()?.logs ?? [] }));
  app.get("/api/alerts", async () => ({ alerts: monitor.latest()?.alerts ?? [] }));
  app.get("/api/metrics", async (request) => {
    const limit = Number((request.query as { limit?: string }).limit || 120);
    return { metrics: monitor.metricsHistory(Math.min(Math.max(limit, 1), 500)) };
  });
};
