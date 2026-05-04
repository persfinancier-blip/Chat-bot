import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, Cpu, FileWarning, Server, Settings, ShieldCheck } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AlertItem, JobRun, LogHeartbeat, Overview, WorkerState } from "../lib/api";
import {
  cloneDefaultSettings,
  type GlobalControlSettings,
  type IncidentSeverity,
  loadGlobalControlSettings,
  saveGlobalControlSettings,
  severityFromAlertLevel
} from "../lib/globalControlSettings";
import { fmtPct, fmtTime } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { MetricTile } from "../components/MetricTile";
import { SettingsDialog } from "../components/SettingsDialog";

type SettingsSection = keyof GlobalControlSettings;

interface GlobalControlPanelProps {
  overview?: Overview;
  jobs: JobRun[];
  logs: LogHeartbeat[];
  workers: WorkerState[];
}

export const GlobalControlPanel = ({ overview, jobs, logs, workers }: GlobalControlPanelProps) => {
  const [settings, setSettings] = useState<GlobalControlSettings>(() => loadGlobalControlSettings());
  const [draft, setDraft] = useState<GlobalControlSettings>(() => loadGlobalControlSettings());
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);

  const score = overview?.healthScore ?? 0;
  const metrics = overview?.metrics;
  const alerts = overview?.alerts ?? [];
  const chart = [{ name: "состояние", value: score }, { name: "риск", value: 100 - score }];

  const incidentSources = useMemo(() => unique(alerts.map((alert) => alert.source).filter(Boolean)), [alerts]);
  const filteredAlerts = useMemo(() => filterAlerts(alerts, settings), [alerts, settings]);
  const scopedJobs = useMemo(() => filterJobsBySelection(jobs, settings), [jobs, settings]);
  const problemJobs = useMemo(() => filterProblemJobs(scopedJobs, settings), [scopedJobs, settings]);
  const scopedWorkers = useMemo(() => filterWorkersBySelection(workers, settings), [workers, settings]);
  const problemWorkers = useMemo(() => scopedWorkers.filter((worker) => worker.status === "crit"), [scopedWorkers]);
  const scopedLogs = useMemo(() => filterLogsBySelection(logs, settings), [logs, settings]);
  const staleLogs = useMemo(() => filterStaleLogs(scopedLogs, settings), [scopedLogs, settings]);

  const openSettings = (section: SettingsSection) => {
    setDraft(settings);
    setActiveSection(section);
  };

  const saveSettings = () => {
    setSettings(draft);
    saveGlobalControlSettings(draft);
    setActiveSection(null);
  };

  const resetSettings = () => {
    const next = cloneDefaultSettings();
    setDraft(next);
    setSettings(next);
    saveGlobalControlSettings(next);
    setActiveSection(null);
  };

  const topCardsEnabled = settings.healthCore.enabled || settings.incidents.enabled;
  const topGridClass = settings.healthCore.enabled && settings.incidents.enabled ? "lg:grid-cols-[1.2fr_2fr]" : "lg:grid-cols-1";

  return (
    <div className="grid gap-4">
      {topCardsEnabled ? (
        <div className={`grid gap-4 ${topGridClass}`}>
          {settings.healthCore.enabled ? (
            <Card>
              <CardHeader>
                <CardTitle>Общий индекс состояния</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge tone={overview?.collectorMode === "ssh" ? "ok" : overview?.collectorMode === "mock" ? "warn" : "info"}>{overview?.collectorMode ?? "booting"}</Badge>
                  <SettingsButton onClick={() => openSettings("healthCore")} />
                </div>
              </CardHeader>
              {settings.healthCore.showRing || settings.healthCore.showScore || settings.healthCore.showScoreLabel || settings.healthCore.showLastCollection ? (
                <div className={settings.healthCore.showRing ? "grid grid-cols-[180px_1fr] items-center gap-5" : "grid items-center gap-5"}>
                  {settings.healthCore.showRing ? (
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
                  ) : null}
                  <div>
                    {settings.healthCore.showScore ? <div className="font-mono text-6xl font-bold text-matrix-green">{score}</div> : null}
                    {settings.healthCore.showScoreLabel ? <div className="mt-2 text-sm text-white/60">индекс работоспособности / 100</div> : null}
                    {settings.healthCore.showLastCollection ? <div className="mt-4 text-xs text-white/45">последний сбор данных: {fmtTime(overview?.collectedAt)}</div> : null}
                  </div>
                </div>
              ) : (
                <EmptyState text="Элементы индекса скрыты настройками" />
              )}
            </Card>
          ) : null}

          {settings.incidents.enabled ? (
            <Card>
              <CardHeader>
                <CardTitle>Активные инциденты</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge tone={filteredAlerts.length > 0 ? "crit" : "ok"}>{filteredAlerts.length}</Badge>
                  <SettingsButton onClick={() => openSettings("incidents")} />
                </div>
              </CardHeader>
              <div className="grid max-h-56 gap-2 overflow-auto pr-1">
                {filteredAlerts.slice(0, settings.incidents.maxItems).map((alert) => (
                  <div key={alert.id} className="rounded border border-white/10 bg-black/20 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {settings.incidents.showSeverity ? <Badge tone={alert.level}>{levelLabel(alert.level)}</Badge> : null}
                      <span className="font-mono text-sm text-white">{alertTitle(alert.title)}</span>
                      {settings.incidents.showSourceName ? <span className="font-mono text-xs text-matrix-cyan">{alert.source}</span> : null}
                    </div>
                    {settings.incidents.showDescription ? <div className="mt-1 text-xs text-white/55">{alertMessage(alert.message)}</div> : null}
                  </div>
                ))}
                {filteredAlerts.length === 0 ? <EmptyState text="Нет активных инцидентов по выбранным фильтрам" /> : null}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {settings.criticalJobs.enabled ? (
          <MetricTile
            icon={Activity}
            label="Проблемные задачи"
            value={`${problemJobs.length} из ${scopedJobs.length}`}
            hint={problemJobs.length ? "упали или зависли" : "Нет проблемных задач по выбранным фильтрам"}
            tone={problemJobs.length ? "crit" : "ok"}
            action={<SettingsButton onClick={() => openSettings("criticalJobs")} />}
          />
        ) : null}
        {settings.criticalWorkers.enabled ? (
          <MetricTile
            icon={Server}
            label="Проблемные воркеры"
            value={`${problemWorkers.length} из ${scopedWorkers.length}`}
            hint={problemWorkers.length ? "состояние systemd-сервисов" : "Нет проблемных воркеров по выбранным фильтрам"}
            tone={problemWorkers.length ? "crit" : "ok"}
            action={<SettingsButton onClick={() => openSettings("criticalWorkers")} />}
          />
        ) : null}
        {settings.staleLogs.enabled ? (
          <MetricTile
            icon={FileWarning}
            label="Логи без обновления"
            value={`${staleLogs.length} из ${scopedLogs.length}`}
            hint={staleLogs.length ? "нет новых записей дольше порога" : "Нет логов без обновления по выбранным фильтрам"}
            tone={staleLogs.length ? "warn" : "ok"}
            action={<SettingsButton onClick={() => openSettings("staleLogs")} />}
          />
        ) : null}
        {settings.cpuRam.enabled ? (
          <MetricTile
            icon={Cpu}
            label="Процессор / память"
            value={cpuRamValue(metrics, settings)}
            hint={settings.cpuRam.showLoad ? `нагрузка ${metrics?.load1 ?? 0} / ${metrics?.load5 ?? 0}` : "нагрузка скрыта настройками"}
            percent={settings.cpuRam.showProgress && settings.cpuRam.showRam ? metrics?.ramPct ?? 0 : undefined}
            tone={(metrics?.ramPct ?? 0) > 90 ? "crit" : (metrics?.ramPct ?? 0) > 80 ? "warn" : "ok"}
            action={<SettingsButton onClick={() => openSettings("cpuRam")} />}
          />
        ) : null}
      </div>

      {settings.telemetryContract.enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Что проверяет мониторинг</CardTitle>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-matrix-cyan" />
              <SettingsButton onClick={() => openSettings("telemetryContract")} />
            </div>
          </CardHeader>
          <div className="grid gap-3 text-sm text-white/60 md:grid-cols-4">
            {settings.telemetryContract.showPolling ? <div>опрос: каждые 15-60 сек, настраивается</div> : null}
            {settings.telemetryContract.showStorage ? <div>хранение: live-буфер в памяти</div> : null}
            {settings.telemetryContract.showAlerts ? <div>алерты: задачи / логи / сервисы / сервер</div> : null}
            {settings.telemetryContract.showMode ? <div>режим: только чтение, без изменений</div> : null}
            {!settings.telemetryContract.showPolling && !settings.telemetryContract.showStorage && !settings.telemetryContract.showAlerts && !settings.telemetryContract.showMode ? (
              <div className="md:col-span-4">Все пункты скрыты настройками</div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {activeSection ? (
        <SettingsDialog title={`Настройки: ${sectionTitle(activeSection)}`} onSave={saveSettings} onCancel={() => setActiveSection(null)} onReset={resetSettings}>
          <SettingsForm section={activeSection} draft={draft} setDraft={setDraft} jobs={jobs} logs={logs} workers={workers} incidentSources={incidentSources} />
        </SettingsDialog>
      ) : null}
    </div>
  );
};

const SettingsButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-7 w-7 items-center justify-center rounded border border-matrix-line bg-black/20 text-white/55 hover:border-matrix-cyan hover:text-matrix-cyan"
    aria-label="Открыть настройки"
  >
    <Settings className="h-3.5 w-3.5" />
  </button>
);

const SettingsForm = ({
  section,
  draft,
  setDraft,
  jobs,
  logs,
  workers,
  incidentSources
}: {
  section: SettingsSection;
  draft: GlobalControlSettings;
  setDraft: (settings: GlobalControlSettings) => void;
  jobs: JobRun[];
  logs: LogHeartbeat[];
  workers: WorkerState[];
  incidentSources: string[];
}) => {
  const update = <K extends SettingsSection>(key: K, value: GlobalControlSettings[K]) => setDraft({ ...draft, [key]: value });

  if (section === "healthCore") {
    const value = draft.healthCore;
    return (
      <SettingsStack>
        <Toggle checked={value.enabled} label="Показывать окно" onChange={(enabled) => update("healthCore", { ...value, enabled })} />
        <Toggle checked={value.showRing} label="Показывать кольцо" onChange={(showRing) => update("healthCore", { ...value, showRing })} />
        <Toggle checked={value.showScore} label="Показывать число индекса" onChange={(showScore) => update("healthCore", { ...value, showScore })} />
        <Toggle checked={value.showScoreLabel} label="Показывать подпись индекса" onChange={(showScoreLabel) => update("healthCore", { ...value, showScoreLabel })} />
        <Toggle checked={value.showLastCollection} label="Показывать дату последнего сбора данных" onChange={(showLastCollection) => update("healthCore", { ...value, showLastCollection })} />
      </SettingsStack>
    );
  }

  if (section === "incidents") {
    const value = draft.incidents;
    return (
      <SettingsStack>
        <Toggle checked={value.enabled} label="Показывать окно" onChange={(enabled) => update("incidents", { ...value, enabled })} />
        <Toggle checked={value.showSeverity} label="Показывать уровень инцидента" onChange={(showSeverity) => update("incidents", { ...value, showSeverity })} />
        <Toggle checked={value.showSourceName} label="Показывать источник" onChange={(showSourceName) => update("incidents", { ...value, showSourceName })} />
        <Toggle checked={value.showDescription} label="Показывать описание" onChange={(showDescription) => update("incidents", { ...value, showDescription })} />
        <SelectNumber label="Сколько инцидентов выводить" value={value.maxItems} options={[5, 10, 12, 25]} onChange={(maxItems) => update("incidents", { ...value, maxItems })} />
        <CheckboxGroup
          title="Уровни инцидентов"
          items={[
            { value: "critical", label: "Критичные" },
            { value: "warn", label: "Внимание" },
            { value: "info", label: "Информационные" }
          ]}
          selected={value.severities}
          emptyText=""
          onChange={(severities) => update("incidents", { ...value, severities: severities as IncidentSeverity[] })}
        />
        <CheckboxGroup
          title="Источники инцидентов"
          items={incidentSources.map((source) => ({ value: source, label: source }))}
          selected={value.sources}
          emptyText="Список источников пока пуст"
          onChange={(sources) => update("incidents", { ...value, sources })}
        />
      </SettingsStack>
    );
  }

  if (section === "criticalJobs") {
    const value = draft.criticalJobs;
    return (
      <SettingsStack>
        <Toggle checked={value.enabled} label="Показывать окно" onChange={(enabled) => update("criticalJobs", { ...value, enabled })} />
        <Toggle checked={value.showFailed} label="Учитывать упавшие задачи" onChange={(showFailed) => update("criticalJobs", { ...value, showFailed })} />
        <Toggle checked={value.showStuck} label="Учитывать зависшие задачи" onChange={(showStuck) => update("criticalJobs", { ...value, showStuck })} />
        <CheckboxGroup
          title="Задачи"
          items={jobs.map((job) => ({ value: job.unit, label: jobLabel(job) }))}
          selected={value.selectedJobs}
          emptyText="Список задач пока пуст"
          onChange={(selectedJobs) => update("criticalJobs", { ...value, selectedJobs })}
        />
      </SettingsStack>
    );
  }

  if (section === "criticalWorkers") {
    const value = draft.criticalWorkers;
    return (
      <SettingsStack>
        <Toggle checked={value.enabled} label="Показывать окно" onChange={(enabled) => update("criticalWorkers", { ...value, enabled })} />
        <CheckboxGroup
          title="Воркеры"
          items={workers.map((worker) => ({ value: worker.unit, label: worker.unit }))}
          selected={value.selectedWorkers}
          emptyText="Список воркеров пока пуст"
          onChange={(selectedWorkers) => update("criticalWorkers", { ...value, selectedWorkers })}
        />
        <CheckboxGroup
          title="Сервисы"
          items={workers.map((worker) => ({ value: worker.name, label: worker.name || worker.unit }))}
          selected={value.selectedServices}
          emptyText="Список сервисов пока пуст"
          onChange={(selectedServices) => update("criticalWorkers", { ...value, selectedServices })}
        />
      </SettingsStack>
    );
  }

  if (section === "staleLogs") {
    const value = draft.staleLogs;
    return (
      <SettingsStack>
        <Toggle checked={value.enabled} label="Показывать окно" onChange={(enabled) => update("staleLogs", { ...value, enabled })} />
        <NumberInput label="Порог без обновления, минут" value={value.thresholdMin} onChange={(thresholdMin) => update("staleLogs", { ...value, thresholdMin })} />
        <CheckboxGroup
          title="Логи"
          items={logs.map((log) => ({ value: log.fileName, label: log.fileName }))}
          selected={value.selectedLogs}
          emptyText="Список логов пока пуст"
          onChange={(selectedLogs) => update("staleLogs", { ...value, selectedLogs })}
        />
      </SettingsStack>
    );
  }

  if (section === "cpuRam") {
    const value = draft.cpuRam;
    return (
      <SettingsStack>
        <Toggle checked={value.enabled} label="Показывать окно" onChange={(enabled) => update("cpuRam", { ...value, enabled })} />
        <Toggle checked={value.showCpu} label="Показывать процессор" onChange={(showCpu) => update("cpuRam", { ...value, showCpu })} />
        <Toggle checked={value.showRam} label="Показывать память" onChange={(showRam) => update("cpuRam", { ...value, showRam })} />
        <Toggle checked={value.showLoad} label="Показывать нагрузку" onChange={(showLoad) => update("cpuRam", { ...value, showLoad })} />
        <Toggle checked={value.showProgress} label="Показывать индикатор" onChange={(showProgress) => update("cpuRam", { ...value, showProgress })} />
      </SettingsStack>
    );
  }

  const value = draft.telemetryContract;
  return (
    <SettingsStack>
      <Toggle checked={value.enabled} label="Показывать окно" onChange={(enabled) => update("telemetryContract", { ...value, enabled })} />
      <Toggle checked={value.showPolling} label="Показывать опрос" onChange={(showPolling) => update("telemetryContract", { ...value, showPolling })} />
      <Toggle checked={value.showStorage} label="Показывать хранение" onChange={(showStorage) => update("telemetryContract", { ...value, showStorage })} />
      <Toggle checked={value.showAlerts} label="Показывать алерты" onChange={(showAlerts) => update("telemetryContract", { ...value, showAlerts })} />
      <Toggle checked={value.showMode} label="Показывать режим" onChange={(showMode) => update("telemetryContract", { ...value, showMode })} />
    </SettingsStack>
  );
};

const SettingsStack = ({ children }: { children: ReactNode }) => <div className="grid gap-4">{children}</div>;

const Toggle = ({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center justify-between gap-3 rounded border border-matrix-line bg-black/20 p-3 text-sm text-white/70">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-matrix-green" />
  </label>
);

const SelectNumber = ({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (value: number) => void }) => (
  <label className="grid gap-2 text-sm text-white/70">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(Number(event.target.value))} className="rounded border border-matrix-line bg-black/40 p-2 text-white">
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </label>
);

const NumberInput = ({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) => (
  <label className="grid gap-2 text-sm text-white/70">
    <span>{label}</span>
    <input
      type="number"
      min={1}
      placeholder="авто"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className="rounded border border-matrix-line bg-black/40 p-2 text-white"
    />
  </label>
);

const CheckboxGroup = ({
  title,
  items,
  selected,
  emptyText,
  onChange
}: {
  title: string;
  items: Array<{ value: string; label: string }>;
  selected: string[];
  emptyText: string;
  onChange: (selected: string[]) => void;
}) => (
  <div className="grid gap-2">
    <div className="font-mono text-xs uppercase text-white/45">{title}</div>
    {items.length ? (
      <div className="grid max-h-48 gap-2 overflow-auto rounded border border-matrix-line bg-black/20 p-2">
        {items.map((item) => (
          <label key={item.value} className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={selected.includes(item.value)}
              onChange={(event) => onChange(toggleListValue(selected, item.value, event.target.checked))}
              className="h-4 w-4 accent-matrix-green"
            />
            <span className="truncate">{item.label}</span>
          </label>
        ))}
      </div>
    ) : (
      <div className="rounded border border-matrix-line bg-black/20 p-3 text-sm text-white/45">{emptyText}</div>
    )}
  </div>
);

const EmptyState = ({ text }: { text: string }) => <div className="text-sm text-white/50">{text}</div>;

const toggleListValue = (items: string[], value: string, checked: boolean): string[] => checked ? unique([...items, value]) : items.filter((item) => item !== value);
const unique = (items: string[]) => Array.from(new Set(items));

const filterAlerts = (alerts: AlertItem[], settings: GlobalControlSettings) => {
  const severitySet = new Set(settings.incidents.severities);
  const sourceSet = new Set(settings.incidents.sources);
  return alerts.filter((alert) => severitySet.has(severityFromAlertLevel(alert.level)) && (!sourceSet.size || sourceSet.has(alert.source)));
};

const filterJobsBySelection = (jobs: JobRun[], settings: GlobalControlSettings) => {
  const selected = new Set(settings.criticalJobs.selectedJobs);
  return selected.size ? jobs.filter((job) => selected.has(job.unit)) : jobs;
};

const filterProblemJobs = (jobs: JobRun[], settings: GlobalControlSettings) => jobs.filter((job) => (
  (settings.criticalJobs.showFailed && job.status === "failed") || (settings.criticalJobs.showStuck && job.status === "stuck")
));

const filterWorkersBySelection = (workers: WorkerState[], settings: GlobalControlSettings) => {
  const selectedWorkers = new Set(settings.criticalWorkers.selectedWorkers);
  const selectedServices = new Set(settings.criticalWorkers.selectedServices);
  if (!selectedWorkers.size && !selectedServices.size) return workers;
  return workers.filter((worker) => selectedWorkers.has(worker.unit) || selectedServices.has(worker.name));
};

const filterLogsBySelection = (logs: LogHeartbeat[], settings: GlobalControlSettings) => {
  const selected = new Set(settings.staleLogs.selectedLogs);
  return selected.size ? logs.filter((log) => selected.has(log.fileName)) : logs;
};

const filterStaleLogs = (logs: LogHeartbeat[], settings: GlobalControlSettings) => {
  const thresholdMin = settings.staleLogs.thresholdMin;
  if (!thresholdMin) return logs.filter((log) => log.stale);
  return logs.filter((log) => {
    if (!log.lastWriteAt) return true;
    return (Date.now() - Date.parse(log.lastWriteAt)) / 60_000 > thresholdMin;
  });
};

const cpuRamValue = (metrics: Overview["metrics"], settings: GlobalControlSettings): string => {
  const parts: string[] = [];
  if (settings.cpuRam.showCpu) parts.push(fmtPct(metrics?.cpuPct));
  if (settings.cpuRam.showRam) parts.push(fmtPct(metrics?.ramPct));
  return parts.length ? parts.join(" / ") : "скрыто";
};

const sectionTitle = (section: SettingsSection): string => {
  const titles: Record<SettingsSection, string> = {
    healthCore: "Общий индекс состояния",
    incidents: "Активные инциденты",
    criticalJobs: "Проблемные задачи",
    criticalWorkers: "Проблемные воркеры",
    staleLogs: "Логи без обновления",
    cpuRam: "Процессор / память",
    telemetryContract: "Что проверяет мониторинг"
  };
  return titles[section];
};

const jobLabel = (job: JobRun): string => `${job.name}${job.schedule ? ` / ${job.schedule}` : ""} / ${job.unit}`;

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
