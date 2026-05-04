import type { AlertItem, HostMetrics, JobRun, LogHeartbeat, Snapshot, WorkerState } from "../types/models.js";

const DEFAULT_LIMIT = 300;

const trim = <T>(items: T[], limit = DEFAULT_LIMIT): T[] => {
  if (items.length <= limit) return items;
  return items.slice(items.length - limit);
};

export class InMemoryStore {
  private current?: Snapshot;
  private metrics: HostMetrics[] = [];
  private jobHistory: JobRun[] = [];
  private workerHistory: WorkerState[] = [];
  private logHistory: LogHeartbeat[] = [];
  private alertHistory: AlertItem[] = [];

  saveSnapshot(snapshot: Snapshot): void {
    this.current = snapshot;
    this.metrics = trim([...this.metrics, snapshot.metrics]);
    this.jobHistory = trim([...this.jobHistory, ...snapshot.jobs]);
    this.workerHistory = trim([...this.workerHistory, ...snapshot.workers]);
    this.logHistory = trim([...this.logHistory, ...snapshot.logs]);
    this.alertHistory = trim([...this.alertHistory, ...snapshot.alerts]);
  }

  latestSnapshot(): Snapshot | undefined {
    return this.current;
  }

  latestJobs(): JobRun[] {
    return this.current?.jobs ?? [];
  }

  latestWorkers(): WorkerState[] {
    return this.current?.workers ?? [];
  }

  latestLogs(): LogHeartbeat[] {
    return this.current?.logs ?? [];
  }

  activeAlerts(): AlertItem[] {
    return this.current?.alerts ?? [];
  }

  metricsHistory(limit = 120): HostMetrics[] {
    return this.metrics.slice(-Math.min(Math.max(limit, 1), DEFAULT_LIMIT));
  }
}
