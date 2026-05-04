import type { AppConfig, HealthResponse, LogHeartbeat, Snapshot } from "../types/models.js";
import { hasSshConfig, redact } from "../config.js";
import { collectLocalSnapshot } from "../collectors/localCollector.js";
import { collectMockSnapshot } from "../collectors/mockCollector.js";
import { collectSshSnapshot } from "../collectors/sshCollector.js";
import type { InMemoryStore } from "./memoryStore.js";
import { computeHealthScore } from "./alerts.js";

export class MonitoringService {
  private timer?: NodeJS.Timeout;
  private lastSnapshot?: Snapshot;
  private collecting = false;

  constructor(
    private readonly config: AppConfig,
    private readonly store: InMemoryStore
  ) {}

  start(): void {
    void this.collectOnce();
    this.timer = setInterval(() => void this.collectOnce(), this.config.pollIntervalSec * 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  latest(): Snapshot | undefined {
    return this.store.latestSnapshot() ?? this.lastSnapshot;
  }

  metricsHistory(limit = 120) {
    return this.store.metricsHistory(limit);
  }

  health(): HealthResponse {
    const latest = this.latest();
    if (!latest) {
      return {
        ok: false,
        collector: "booting",
        connectionOk: false,
        degraded: true,
        reason: "collector booting",
        healthScore: 0
      };
    }

    const reason = latest.collectorErrors.length ? latest.collectorErrors.join("; ") : undefined;
    const degraded = latest.mode === "mock" || latest.collectorErrors.length > 0;
    return {
      ok: !degraded,
      collector: latest.mode,
      connectionOk: latest.mode === "ssh" || latest.mode === "local",
      degraded,
      reason,
      lastSyncAt: latest.collectedAt,
      healthScore: computeHealthScore(latest.alerts)
    };
  }

  async collectOnce(): Promise<Snapshot> {
    if (this.collecting) {
      return this.lastSnapshot ?? collectMockSnapshot(this.config, "collector already running");
    }
    this.collecting = true;
    try {
      const snapshot = await this.collect();
      this.enrichLogRates(snapshot.logs);
      this.store.saveSnapshot(snapshot);
      this.lastSnapshot = snapshot;
      return snapshot;
    } finally {
      this.collecting = false;
    }
  }

  private async collect(): Promise<Snapshot> {
    if (this.config.collectorMode === "mock") {
      return collectMockSnapshot(this.config, "COLLECTOR_MODE=mock");
    }

    if (this.config.collectorMode === "ssh" || (this.config.collectorMode === "auto" && hasSshConfig(this.config))) {
      if (!hasSshConfig(this.config)) {
        return collectMockSnapshot(this.config, "SSH config missing; running seed/mock mode");
      }
      try {
        return await collectSshSnapshot(this.config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return collectMockSnapshot(this.config, `SSH collector failed: ${redact(message)}`);
      }
    }

    if (this.config.collectorMode === "local") {
      try {
        return await collectLocalSnapshot(this.config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return collectMockSnapshot(this.config, `Local collector failed: ${redact(message)}`);
      }
    }

    return collectMockSnapshot(this.config, "SSH config missing; running seed/mock mode");
  }

  private enrichLogRates(logs: LogHeartbeat[]): void {
    const previous = new Map(this.store.latestLogs().map((log) => [log.path, log]));
    for (const log of logs) {
      const prev = previous.get(log.path);
      if (!prev) continue;
      const elapsedMin = (Date.parse(log.updatedAt) - Date.parse(prev.updatedAt)) / 60_000;
      if (elapsedMin <= 0) continue;
      log.linesPerMin = Math.max(0, Math.round(((log.totalLines - prev.totalLines) / elapsedMin) * 10) / 10);
    }
  }
}
