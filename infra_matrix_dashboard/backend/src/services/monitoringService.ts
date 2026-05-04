import type { AppConfig, LogHeartbeat, Snapshot } from "../types/models.js";
import { hasSshConfig, redact } from "../config.js";
import { collectLocalSnapshot } from "../collectors/localCollector.js";
import { collectMockSnapshot } from "../collectors/mockCollector.js";
import { collectSshSnapshot } from "../collectors/sshCollector.js";
import type { DashboardDb } from "../db/database.js";

export class MonitoringService {
  private timer?: NodeJS.Timeout;
  private lastSnapshot?: Snapshot;
  private collecting = false;

  constructor(
    private readonly config: AppConfig,
    private readonly db: DashboardDb
  ) {}

  start(): void {
    void this.collectOnce();
    this.timer = setInterval(() => void this.collectOnce(), this.config.pollIntervalSec * 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  latest(): Snapshot | undefined {
    return this.lastSnapshot;
  }

  async collectOnce(): Promise<Snapshot> {
    if (this.collecting) {
      return this.lastSnapshot ?? collectMockSnapshot(this.config, "collector already running");
    }
    this.collecting = true;
    try {
      const snapshot = await this.collect();
      this.enrichLogRates(snapshot.logs);
      this.db.saveSnapshot(snapshot);
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

    if (this.config.collectorMode === "local" || this.config.appEnv === "prod") {
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
    const previous = new Map(this.db.latestLogs().map((log) => [log.path, log]));
    for (const log of logs) {
      const prev = previous.get(log.path);
      if (!prev) continue;
      const elapsedMin = (Date.parse(log.updatedAt) - Date.parse(prev.updatedAt)) / 60_000;
      if (elapsedMin <= 0) continue;
      log.linesPerMin = Math.max(0, Math.round(((log.totalLines - prev.totalLines) / elapsedMin) * 10) / 10);
    }
  }
}
