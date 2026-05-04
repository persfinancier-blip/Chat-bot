import { useEffect, useMemo, useState } from "react";
import { Activity, FileText, LayoutDashboard, RefreshCcw, ServerCog } from "lucide-react";
import { api, type HealthResponse, type HostMetrics, type JobRun, type LogHeartbeat, type Overview, type WorkerState } from "./lib/api";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { GlobalControlPanel } from "./views/GlobalControlPanel";
import { JobsMatrix } from "./views/JobsMatrix";
import { LogsObservatory } from "./views/LogsObservatory";
import { WorkersHost } from "./views/WorkersHost";
import { cn, fmtTime } from "./lib/utils";

type View = "control" | "jobs" | "logs" | "workers";

const views: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "control", label: "Global Control", icon: LayoutDashboard },
  { id: "jobs", label: "Jobs Matrix", icon: Activity },
  { id: "logs", label: "Logs Observatory", icon: FileText },
  { id: "workers", label: "Workers & Host", icon: ServerCog }
];

export default function App() {
  const [view, setView] = useState<View>("control");
  const [overview, setOverview] = useState<Overview>();
  const [health, setHealth] = useState<HealthResponse>();
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [logs, setLogs] = useState<LogHeartbeat[]>([]);
  const [workers, setWorkers] = useState<WorkerState[]>([]);
  const [metrics, setMetrics] = useState<HostMetrics[]>([]);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setError(undefined);
      const [nextHealth, nextOverview, nextJobs, nextLogs, nextWorkers, nextMetrics] = await Promise.all([
        api.health(),
        api.overview(),
        api.jobs(),
        api.logs(),
        api.workers(),
        api.metrics()
      ]);
      setHealth(nextHealth);
      setOverview(nextOverview);
      setJobs(nextJobs);
      setLogs(nextLogs);
      setWorkers(nextWorkers);
      setMetrics(nextMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, []);

  const headline = useMemo(() => {
    const score = overview?.healthScore ?? 0;
    if (score >= 90) return "nominal telemetry field";
    if (score >= 70) return "degraded but operational";
    return "critical anomalies detected";
  }, [overview?.healthScore]);

  const manualCollect = async () => {
    setRefreshing(true);
    try {
      await api.collect();
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <main className="scanline min-h-screen p-4 text-white md:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col gap-4 border-b border-matrix-line pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.35em] text-matrix-cyan">Silver Bullet Observability</div>
            <h1 className="mt-2 text-3xl font-semibold text-white md:text-5xl">Infra Matrix Dashboard</h1>
            <div className="mt-2 text-sm text-white/55">{headline} / last sync {fmtTime(health?.lastSyncAt ?? overview?.lastSyncAt ?? overview?.collectedAt)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={health?.collector === "ssh" ? "ok" : health?.collector === "mock" ? "warn" : "info"}>{health?.collector ?? overview?.collectorMode ?? "booting"}</Badge>
            <Badge tone={health?.connectionOk ? "ok" : "crit"}>{health?.connectionOk ? "connection ok" : "connection degraded"}</Badge>
            <Badge tone={(overview?.healthScore ?? 0) >= 80 ? "ok" : (overview?.healthScore ?? 0) >= 60 ? "warn" : "crit"}>health {overview?.healthScore ?? "..."}</Badge>
            <Button onClick={manualCollect} disabled={refreshing}>
              <RefreshCcw className="mr-2 inline h-3.5 w-3.5" />
              refresh
            </Button>
          </div>
        </header>

        {error ? <div className="mb-4 rounded border border-matrix-red/50 bg-matrix-red/10 p-3 text-sm text-matrix-red">API error: {error}</div> : null}
        {health?.degraded ? (
          <div className="mb-4 rounded border border-matrix-red/50 bg-matrix-red/10 p-3 text-sm text-matrix-red">
            Collector degraded: {health.reason ?? "unknown reason"}
          </div>
        ) : null}

        <nav className="mb-5 grid gap-2 md:grid-cols-4">
          {views.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left font-mono text-sm uppercase transition",
                  view === item.id ? "border-matrix-green bg-matrix-green/15 text-matrix-green shadow-glow" : "border-matrix-line bg-black/20 text-white/55 hover:border-matrix-cyan hover:text-matrix-cyan"
                )}
              >
                <Icon className="mr-2 inline h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {view === "control" ? <GlobalControlPanel overview={overview} /> : null}
        {view === "jobs" ? <JobsMatrix jobs={jobs} /> : null}
        {view === "logs" ? <LogsObservatory logs={logs} /> : null}
        {view === "workers" ? <WorkersHost workers={workers} metrics={metrics} /> : null}
      </div>
    </main>
  );
}
