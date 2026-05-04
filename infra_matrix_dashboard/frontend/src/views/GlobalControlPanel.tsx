import { Activity, Cpu, FileWarning, Server, ShieldCheck } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Overview } from "../lib/api";
import { fmtPct, fmtTime } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { MetricTile } from "../components/MetricTile";

export const GlobalControlPanel = ({ overview }: { overview?: Overview }) => {
  const score = overview?.healthScore ?? 0;
  const metrics = overview?.metrics;
  const chart = [{ name: "состояние", value: score }, { name: "риск", value: 100 - score }];
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Общий индекс состояния</CardTitle>
            <Badge tone={overview?.collectorMode === "ssh" ? "ok" : overview?.collectorMode === "mock" ? "warn" : "info"}>{overview?.collectorMode ?? "booting"}</Badge>
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
              <div className="mt-2 text-sm text-white/60">индекс работоспособности / 100</div>
              <div className="mt-4 text-xs text-white/45">последний сбор данных: {fmtTime(overview?.collectedAt)}</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Активные инциденты</CardTitle>
            <Badge tone={(overview?.alerts.length ?? 0) > 0 ? "crit" : "ok"}>{overview?.alerts.length ?? 0}</Badge>
          </CardHeader>
          <div className="grid max-h-56 gap-2 overflow-auto pr-1">
            {(overview?.alerts ?? []).slice(0, 8).map((alert) => (
              <div key={alert.id} className="rounded border border-white/10 bg-black/20 p-2">
                <div className="flex items-center gap-2">
                  <Badge tone={alert.level}>{levelLabel(alert.level)}</Badge>
                  <span className="font-mono text-sm text-white">{alertTitle(alert.title)}</span>
                </div>
                <div className="mt-1 text-xs text-white/55">{alertMessage(alert.message)}</div>
              </div>
            ))}
            {overview?.alerts.length === 0 ? <div className="text-sm text-white/50">Активных инцидентов нет.</div> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={Activity} label="Проблемные задачи" value={`${overview?.kpis.jobsCritical ?? 0} из ${overview?.kpis.jobsTotal ?? 0}`} hint="упали или зависли" tone={(overview?.kpis.jobsCritical ?? 0) ? "crit" : "ok"} />
        <MetricTile icon={Server} label="Проблемные воркеры" value={`${overview?.kpis.workersCritical ?? 0} из ${overview?.kpis.workersTotal ?? 0}`} hint="состояние systemd-сервисов" tone={(overview?.kpis.workersCritical ?? 0) ? "crit" : "ok"} />
        <MetricTile icon={FileWarning} label="Логи без обновления" value={`${overview?.kpis.staleLogs ?? 0} из ${overview?.kpis.logsTotal ?? 0}`} hint="нет новых записей дольше порога" tone={(overview?.kpis.staleLogs ?? 0) ? "warn" : "ok"} />
        <MetricTile icon={Cpu} label="Процессор / память" value={`${fmtPct(metrics?.cpuPct)} / ${fmtPct(metrics?.ramPct)}`} hint={`нагрузка ${metrics?.load1 ?? 0} / ${metrics?.load5 ?? 0}`} percent={metrics?.ramPct ?? 0} tone={(metrics?.ramPct ?? 0) > 90 ? "crit" : (metrics?.ramPct ?? 0) > 80 ? "warn" : "ok"} />
      </div>

      <Card>
          <CardHeader>
            <CardTitle>Что проверяет мониторинг</CardTitle>
          <ShieldCheck className="h-4 w-4 text-matrix-cyan" />
          </CardHeader>
          <div className="grid gap-3 text-sm text-white/60 md:grid-cols-4">
            <div>опрос: каждые 15-60 сек, настраивается</div>
          <div>хранение: live-буфер в памяти</div>
            <div>алерты: задачи / логи / сервисы / сервер</div>
          <div>режим: только чтение, без изменений</div>
          </div>
      </Card>
    </div>
  );
};

const levelLabel = (level: string): string => {
  if (level === "warn") return "внимание";
  if (level === "crit") return "критично";
  if (level === "info") return "инфо";
  return level;
};

const alertTitle = (title: string): string => {
  const titles: Record<string, string> = {
    "Log stale": "Лог не обновляется",
    "Errors in log": "Ошибки в логе",
    "Collector degraded": "Сборщик в деградации",
    "Failed job": "Задача упала",
    "Stuck job": "Задача зависла",
    "Unknown job state": "Неизвестное состояние задачи",
    "Service unhealthy": "Сервис неисправен",
    "Service warning": "Предупреждение сервиса",
    "CPU critical": "Процессор: критично",
    "CPU high": "Процессор: высокая нагрузка",
    "RAM critical": "Память: критично",
    "RAM high": "Память: высокая нагрузка",
    "Disk critical": "Диск: критично",
    "Disk high": "Диск: высокая нагрузка"
  };
  return titles[title] ?? title;
};

const alertMessage = (message: string): string => {
  const stale = message.match(/^(.+) has no writes within 10 min$/);
  if (stale) return `${stale[1]}: нет новых записей более 10 минут`;
  return message;
};
