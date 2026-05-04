import { Activity, AlertTriangle, Cpu, Database, FileWarning, Server } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Overview } from "../lib/api";
import { fmtPct, fmtTime } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { MetricTile } from "../components/MetricTile";

export const GlobalControlPanel = ({ overview }: { overview?: Overview }) => {
  const score = overview?.healthScore ?? 0;
  const metrics = overview?.metrics;
  const chart = [{ name: "health", value: score }, { name: "risk", value: 100 - score }];
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Global Health Core</CardTitle>
            <Badge tone={overview?.collectorMode === "ssh" ? "ok" : "warn"}>{overview?.collectorMode ?? "booting"}</Badge>
          </CardHeader>
          <div className="grid grid-cols-[180px_1fr] items-center gap-5">
            <div className="h-44">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chart} dataKey="value" innerRadius={58} outerRadius={78} startAngle={90} endAngle={-270}>
                    <Cell fill="#35ff93" />
                    <Cell fill="#123326" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="font-mono text-6xl font-bold text-matrix-green">{score}</div>
              <div className="mt-2 text-sm text-white/60">health score / 100</div>
              <div className="mt-4 text-xs text-white/45">last collection: {fmtTime(overview?.collectedAt)}</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
            <Badge tone={(overview?.alerts.length ?? 0) > 0 ? "crit" : "ok"}>{overview?.alerts.length ?? 0}</Badge>
          </CardHeader>
          <div className="grid max-h-56 gap-2 overflow-auto pr-1">
            {(overview?.alerts ?? []).slice(0, 8).map((alert) => (
              <div key={alert.id} className="rounded border border-white/10 bg-black/20 p-2">
                <div className="flex items-center gap-2">
                  <Badge tone={alert.level}>{alert.level}</Badge>
                  <span className="font-mono text-sm text-white">{alert.title}</span>
                </div>
                <div className="mt-1 text-xs text-white/55">{alert.message}</div>
              </div>
            ))}
            {overview?.alerts.length === 0 ? <div className="text-sm text-white/50">No active incidents detected.</div> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={Activity} label="Critical jobs" value={`${overview?.kpis.jobsCritical ?? 0}/${overview?.kpis.jobsTotal ?? 0}`} hint="failed + stuck jobs" tone={(overview?.kpis.jobsCritical ?? 0) ? "crit" : "ok"} />
        <MetricTile icon={Server} label="Workers critical" value={`${overview?.kpis.workersCritical ?? 0}/${overview?.kpis.workersTotal ?? 0}`} hint="systemd service state" tone={(overview?.kpis.workersCritical ?? 0) ? "crit" : "ok"} />
        <MetricTile icon={FileWarning} label="Stale logs" value={`${overview?.kpis.staleLogs ?? 0}/${overview?.kpis.logsTotal ?? 0}`} hint="heartbeat threshold" tone={(overview?.kpis.staleLogs ?? 0) ? "warn" : "ok"} />
        <MetricTile icon={Cpu} label="CPU / RAM" value={`${fmtPct(metrics?.cpuPct)} / ${fmtPct(metrics?.ramPct)}`} hint={`load ${metrics?.load1 ?? 0} / ${metrics?.load5 ?? 0}`} percent={metrics?.ramPct ?? 0} tone={(metrics?.ramPct ?? 0) > 90 ? "crit" : (metrics?.ramPct ?? 0) > 80 ? "warn" : "ok"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Telemetry Contract</CardTitle>
          <Database className="h-4 w-4 text-matrix-cyan" />
        </CardHeader>
        <div className="grid gap-3 text-sm text-white/60 md:grid-cols-4">
          <div>polling: 15-60 sec configurable</div>
          <div>storage: SQLite MVP</div>
          <div>alerts: jobs/logs/services/host</div>
          <div>mode: read-only SSH collector</div>
        </div>
      </Card>
    </div>
  );
};
