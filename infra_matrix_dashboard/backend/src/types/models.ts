export type HealthStatus = "ok" | "warn" | "crit" | "unknown";
export type JobStatus = "success" | "failed" | "running" | "stuck" | "unknown";
export type AlertLevel = "info" | "warn" | "crit";

export interface AppConfig {
  appEnv: "dev" | "prod";
  collectorMode: "auto" | "mock" | "ssh" | "local";
  apiHost: string;
  apiPort: number;
  frontendOrigin: string;
  pollIntervalSec: number;
  logStaleThresholdMin: number;
  jobStuckThresholdMin: number;
  logsPath: string;
  ssh: {
    host?: string;
    port: number;
    user?: string;
    password?: string;
    keyPath?: string;
  };
}

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
  topProcesses: Array<{
    pid: string;
    command: string;
    cpuPct: number;
    memPct: number;
  }>;
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

export interface Snapshot {
  collectedAt: string;
  mode: "ssh" | "mock" | "local";
  jobs: JobRun[];
  workers: WorkerState[];
  logs: LogHeartbeat[];
  metrics: HostMetrics;
  alerts: AlertItem[];
  collectorErrors: string[];
}

export interface HealthResponse {
  ok: boolean;
  collector: "ssh" | "mock" | "local" | "booting";
  connectionOk: boolean;
  degraded: boolean;
  reason?: string;
  lastSyncAt?: string;
  healthScore: number;
}
