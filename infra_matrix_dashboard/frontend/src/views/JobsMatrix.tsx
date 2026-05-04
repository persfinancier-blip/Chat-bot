import type { JobRun } from "../lib/api";
import { fmtDuration, fmtTime } from "../lib/utils";
import { StatusDot } from "../components/StatusDot";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle } from "../components/ui/card";

const toneForJob = (status: JobRun["status"]) => status === "success" ? "ok" : status === "failed" || status === "stuck" ? "crit" : "warn";
const jobStatusLabel = (status: JobRun["status"]) => {
  const labels: Record<JobRun["status"], string> = {
    success: "успешно",
    failed: "ошибка",
    running: "выполняется",
    stuck: "зависла",
    unknown: "неизвестно"
  };
  return labels[status];
};

export const JobsMatrix = ({ jobs }: { jobs: JobRun[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Матрица задач</CardTitle>
      <Badge tone="info">{jobs.length} cron-задач</Badge>
    </CardHeader>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {jobs.map((job) => (
        <div key={job.unit} className="rounded-lg border border-matrix-line bg-black/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <StatusDot status={job.status} />
              <div className="truncate font-mono text-sm text-white">{job.name}</div>
            </div>
            <Badge tone={toneForJob(job.status)}>{jobStatusLabel(job.status)}</Badge>
          </div>
          <div className="mt-3 grid gap-1 text-xs text-white/55">
            <div>расписание: <span className="text-white/75">{job.schedule ?? "неизвестно"}</span></div>
            <div>последний старт: <span className="text-white/75">{fmtTime(job.lastStart)}</span></div>
            <div>последнее завершение: <span className="text-white/75">{fmtTime(job.lastFinish)}</span></div>
            <div>длительность: <span className="text-white/75">{fmtDuration(job.durationSec)}</span></div>
            <div>следующий запуск: <span className="text-white/75">{fmtTime(job.nextExpectedRun)}</span></div>
            <div>лог: <span className="text-matrix-cyan">{job.logFile ?? "неизвестно"}</span></div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);
