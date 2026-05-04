import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import type { HostMetrics, WorkerState } from "../lib/api";
import { fmtDuration, fmtPct } from "../lib/utils";
import { StatusDot } from "../components/StatusDot";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle } from "../components/ui/card";

export const WorkersHost = ({ workers, metrics }: { workers: WorkerState[]; metrics: HostMetrics[] }) => {
  const latest = metrics.at(-1);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Ресурсы сервера</CardTitle>
            <Badge tone="info">{metrics.length} замеров</Badge>
          </CardHeader>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={metrics}>
                <CartesianGrid stroke="#123326" strokeDasharray="3 3" />
                <XAxis dataKey="ts" tickFormatter={(v) => new Date(v).toLocaleTimeString()} stroke="#6ee7b7" minTickGap={32} />
                <YAxis stroke="#6ee7b7" domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#07110d", border: "1px solid #35ff93", color: "#d8ffe9" }} />
                <Line type="monotone" dataKey="cpuPct" name="Процессор" stroke="#31d7ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ramPct" name="Память" stroke="#35ff93" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="diskPct" name="Диск" stroke="#ffcc66" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Топ процессов</CardTitle>
            <Badge tone="info">процессор</Badge>
          </CardHeader>
          <div className="grid gap-2">
            {(latest?.topProcesses ?? []).map((proc) => (
              <div key={`${proc.pid}-${proc.command}`} className="rounded border border-white/10 bg-black/20 p-2">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-matrix-cyan">pid {proc.pid}</span>
                  <span className="text-matrix-green">{proc.cpuPct}%</span>
                </div>
                <div className="mt-1 truncate text-xs text-white/60">{proc.command}</div>
              </div>
            ))}
            <div className="text-xs text-white/45">Процессор {fmtPct(latest?.cpuPct)} / память {fmtPct(latest?.ramPct)} / диск {fmtPct(latest?.diskPct)}</div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Критические сервисы</CardTitle>
          <Badge tone="info">{workers.length} юнитов</Badge>
        </CardHeader>
        <div className="overflow-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="font-mono text-xs uppercase text-white/45">
              <tr>
                <th className="p-2">юнит</th>
                <th className="p-2">состояние</th>
                <th className="p-2">аптайм</th>
                <th className="p-2">рестарты</th>
                <th className="p-2">код выхода</th>
                <th className="p-2">описание</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.unit} className="border-t border-white/10">
                  <td className="p-2 font-mono text-matrix-cyan"><StatusDot status={worker.status} /> <span className="ml-2">{worker.unit}</span></td>
                  <td className="p-2"><Badge tone={worker.status}>{systemdLabel(worker.activeState)}/{systemdLabel(worker.subState)}</Badge></td>
                  <td className="p-2 text-white/65">{fmtDuration(worker.uptimeSec)}</td>
                  <td className="p-2 text-white/65">{worker.restarts ?? 0}</td>
                  <td className="p-2 text-white/65">{worker.lastExitCode ?? 0}</td>
                  <td className="p-2 text-white/55">{worker.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const systemdLabel = (state: string): string => {
  const labels: Record<string, string> = {
    active: "активен",
    inactive: "неактивен",
    failed: "ошибка",
    running: "работает",
    exited: "завершен",
    dead: "остановлен",
    "auto-restart": "перезапуск",
    reloading: "перезагрузка",
    activating: "запуск",
    deactivating: "остановка"
  };
  return labels[state] ?? state;
};
