import type { JobRun } from "../lib/api";
import { fmtDuration, fmtTime } from "../lib/utils";
import { StatusDot } from "../components/StatusDot";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle } from "../components/ui/card";

const toneForJob = (status: JobRun["status"]) => status === "success" ? "ok" : status === "failed" || status === "stuck" ? "crit" : "warn";

export const JobsMatrix = ({ jobs }: { jobs: JobRun[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Jobs Matrix</CardTitle>
      <Badge tone="info">{jobs.length} cron units</Badge>
    </CardHeader>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {jobs.map((job) => (
        <div key={job.unit} className="rounded-lg border border-matrix-line bg-black/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <StatusDot status={job.status} />
              <div className="truncate font-mono text-sm text-white">{job.name}</div>
            </div>
            <Badge tone={toneForJob(job.status)}>{job.status}</Badge>
          </div>
          <div className="mt-3 grid gap-1 text-xs text-white/55">
            <div>schedule: <span className="text-white/75">{job.schedule ?? "unknown"}</span></div>
            <div>last start: <span className="text-white/75">{fmtTime(job.lastStart)}</span></div>
            <div>last finish: <span className="text-white/75">{fmtTime(job.lastFinish)}</span></div>
            <div>duration: <span className="text-white/75">{fmtDuration(job.durationSec)}</span></div>
            <div>next: <span className="text-white/75">{fmtTime(job.nextExpectedRun)}</span></div>
            <div>log: <span className="text-matrix-cyan">{job.logFile ?? "unknown"}</span></div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);
