export type JobStatus = "success" | "failed" | "running" | "stuck" | "unknown";
export type HealthStatus = "ok" | "warn" | "crit" | "unknown";
export type AlertLevel = "info" | "warn" | "crit";

export interface JobRun {
  name: string;
  unit: string;
  command?: string;
  schedule?: string;
  lastStart?: string;
  lastFinish?: string;
  nextExpectedRun?: string;
  status: JobStatus;
  durationSec?: number;
  logFile?: string;
  criticality: "high" | "medium" | "low";
  updatedAt: string;
}

export interface WorkerState {
  unit: string;
  name: string;
  activeState: string;
  subState: string;
  status: HealthStatus;
  uptimeSec?: number;
  restarts?: number;
  lastExitCode?: number;
  updatedAt: string;
}

export interface LogHeartbeat {
  fileName: string;
  path: string;
  lastWriteAt?: string;
  sizeBytes: number;
  totalLines: number;
  linesPerMin: number;
  errorCount: number;
  topErrors: string[];
  stale: boolean;
  updatedAt: string;
}

export interface HostMetrics {
  ts: string;
  cpuPct: number;
  ramPct: number;
  diskPct: number;
  swapPct: number;
  load1: number;
  load5: number;
  load15: number;
  topProcesses: Array<{ pid: string; command: string; cpuPct: number; memPct: number }>;
}

export interface AlertItem {
  id: string;
  level: AlertLevel;
  type: string;
  title: string;
  message: string;
  source: string;
  createdAt: string;
  active: boolean;
}

export interface Overview {
  collectedAt?: string;
  collectorMode?: "ssh" | "mock";
  healthScore: number;
  kpis: {
    jobsTotal: number;
    jobsCritical: number;
    workersTotal: number;
    workersCritical: number;
    logsTotal: number;
    staleLogs: number;
    activeAlerts: number;
  };
  metrics?: HostMetrics;
  alerts: AlertItem[];
}

export const api = {
  async overview(): Promise<Overview> {
    return getJson("/api/overview");
  },
  async jobs(): Promise<JobRun[]> {
    return (await getJson<{ jobs: JobRun[] }>("/api/jobs")).jobs;
  },
  async logs(): Promise<LogHeartbeat[]> {
    return (await getJson<{ logs: LogHeartbeat[] }>("/api/logs")).logs;
  },
  async workers(): Promise<WorkerState[]> {
    return (await getJson<{ workers: WorkerState[] }>("/api/workers")).workers;
  },
  async metrics(): Promise<HostMetrics[]> {
    return (await getJson<{ metrics: HostMetrics[] }>("/api/metrics?limit=120")).metrics;
  },
  async collect(): Promise<void> {
    await fetch("/api/collect", { method: "POST" });
  }
};

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
};
