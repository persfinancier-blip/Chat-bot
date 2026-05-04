import type { AppConfig, HostMetrics, JobRun, LogHeartbeat, Snapshot, WorkerState } from "../types/models.js";
import { buildAlerts } from "../services/alerts.js";
import { SshClient } from "./sshClient.js";

const remoteScript = (logsPath: string) => `
set -euo pipefail
LOGS_PATH=${shellQuote(logsPath)}
now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "SECTION\\tJOBS"
for u in $(systemctl list-units --type=timer --all --no-legend --no-pager 2>/dev/null | awk '{print $1}' | grep -E 'cron-root-root-[0-9]+\\.timer' | sort -V); do
  svc="\${u%.timer}.service"
  desc=$(systemctl show "$svc" -p Description --value 2>/dev/null | tr '\\t\\n' '  ')
  active=$(systemctl show "$svc" -p ActiveState --value 2>/dev/null)
  sub=$(systemctl show "$svc" -p SubState --value 2>/dev/null)
  result=$(systemctl show "$svc" -p Result --value 2>/dev/null)
  exit_code=$(systemctl show "$svc" -p ExecMainStatus --value 2>/dev/null)
  started=$(systemctl show "$svc" -p ActiveEnterTimestamp --value 2>/dev/null)
  finished=$(systemctl show "$svc" -p InactiveEnterTimestamp --value 2>/dev/null)
  next=$(systemctl show "$u" -p NextElapseUSecRealtime --value 2>/dev/null)
  last=$(systemctl show "$u" -p LastTriggerUSec --value 2>/dev/null)
  echo -e "JOB\\t$u\\t$svc\\t$desc\\t$active\\t$sub\\t$result\\t$exit_code\\t$started\\t$finished\\t$next\\t$last"
done

echo "SECTION\\tWORKERS"
for u in $(systemctl list-units --type=service --all --no-legend --no-pager 2>/dev/null | awk '{print $1}' | grep -E '^(wb_|my_api|postgresql|docker).*\\.service$' | sort); do
  desc=$(systemctl show "$u" -p Description --value 2>/dev/null | tr '\\t\\n' '  ')
  active=$(systemctl show "$u" -p ActiveState --value 2>/dev/null)
  sub=$(systemctl show "$u" -p SubState --value 2>/dev/null)
  restarts=$(systemctl show "$u" -p NRestarts --value 2>/dev/null)
  exit_code=$(systemctl show "$u" -p ExecMainStatus --value 2>/dev/null)
  active_at=$(systemctl show "$u" -p ActiveEnterTimestamp --value 2>/dev/null)
  echo -e "WORKER\\t$u\\t$desc\\t$active\\t$sub\\t$restarts\\t$exit_code\\t$active_at"
done

echo "SECTION\\tLOGS"
if [ -d "$LOGS_PATH" ] && [ -r "$LOGS_PATH" ]; then
  find "$LOGS_PATH" -maxdepth 1 -type f 2>/dev/null | sort | head -n 100 | while read -r f; do
    name=$(basename "$f")
    mtime=$(stat -c %Y "$f" 2>/dev/null || echo 0)
    size=$(stat -c %s "$f" 2>/dev/null || echo 0)
    lines=$(wc -l < "$f" 2>/dev/null | tr -d ' ' || echo 0)
    err_count=$(tail -n 500 "$f" 2>/dev/null | grep -Eic 'ERROR|Exception|Traceback|FATAL' || true)
    echo -e "LOG\\t$name\\t$f\\t$mtime\\t$size\\t$lines\\t$err_count"
    tail -n 500 "$f" 2>/dev/null | grep -Ei 'ERROR|Exception|Traceback|FATAL' | tail -n 5 | sed -E "s#^#ERR\\t$name\\t#" || true
  done
else
  echo -e "REMOTE_ERROR\\tlogs_unreadable\\t$LOGS_PATH"
fi

echo "SECTION\\tMETRICS"
cpu=$(top -bn1 2>/dev/null | awk -F',' '/Cpu\\(s\\)/ {gsub(/[^0-9.]/,\"\",$4); if ($4 != \"\") print 100-$4; else print 0}' | head -n1)
read mem_total mem_used <<< $(free -m | awk '/Mem:/ {print $2, $3}')
read swap_total swap_used <<< $(free -m | awk '/Swap:/ {print $2, $3}')
disk=$(df -P / | awk 'NR==2 {gsub(\"%\", \"\", $5); print $5}')
read load1 load5 load15 rest <<< $(cat /proc/loadavg)
echo -e "METRIC\\t\${cpu:-0}\\t$mem_used\\t$mem_total\\t$swap_used\\t$swap_total\\t\${disk:-0}\\t$load1\\t$load5\\t$load15"
ps -eo pid,pcpu,pmem,comm --sort=-pcpu | head -n 8 | tail -n +2 | awk '{print "PROC\\t"$1"\\t"$2"\\t"$3"\\t"$4}'
`;

export const collectSshSnapshot = async (config: AppConfig): Promise<Snapshot> => {
  const ssh = new SshClient(config);
  const collectedAt = new Date().toISOString();
  const { stdout, stderr, code } = await ssh.exec(remoteScript(config.logsPath), 35_000);
  const errors: string[] = [];
  if (stderr.trim()) errors.push(stderr.trim().slice(0, 1200));
  if (code && code !== 0) errors.push(`remote command exit code ${code}`);

  const parsed = parseRemoteOutput(stdout, config, collectedAt);
  const snapshot: Snapshot = {
    collectedAt,
    mode: "ssh",
    jobs: parsed.jobs,
    workers: parsed.workers,
    logs: parsed.logs,
    metrics: parsed.metrics,
    alerts: [],
    collectorErrors: [...errors, ...parsed.errors]
  };
  snapshot.alerts = buildAlerts(snapshot, config);
  return snapshot;
};

const parseRemoteOutput = (stdout: string, config: AppConfig, collectedAt: string) => {
  const jobs: JobRun[] = [];
  const workers: WorkerState[] = [];
  const logs: LogHeartbeat[] = [];
  const errors: string[] = [];
  let metrics: HostMetrics = emptyMetrics(collectedAt);
  const errorByLog = new Map<string, string[]>();

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("SECTION")) continue;
    const parts = line.split("\t");
    const type = parts[0];
    if (type === "JOB") {
      jobs.push(parseJob(parts, config, collectedAt));
    } else if (type === "WORKER") {
      workers.push(parseWorker(parts, collectedAt));
    } else if (type === "LOG") {
      logs.push(parseLog(parts, config, collectedAt, errorByLog.get(parts[1]) || []));
    } else if (type === "ERR") {
      const fileName = parts[1] || "unknown";
      const message = parts.slice(2).join(" ").slice(0, 240);
      errorByLog.set(fileName, [...(errorByLog.get(fileName) || []), message]);
    } else if (type === "REMOTE_ERROR") {
      errors.push(parts.slice(1).join(" "));
    } else if (type === "METRIC") {
      metrics = parseMetrics(parts, collectedAt);
    } else if (type === "PROC") {
      metrics.topProcesses.push({
        pid: parts[1] || "",
        cpuPct: Number(parts[2] || 0),
        memPct: Number(parts[3] || 0),
        command: parts.slice(4).join(" ")
      });
    }
  }

  for (const log of logs) {
    log.topErrors = errorByLog.get(log.fileName) || log.topErrors;
  }

  return { jobs, workers, logs, metrics, errors };
};

const parseJob = (parts: string[], config: AppConfig, collectedAt: string): JobRun => {
  const unit = parts[1] || "unknown";
  const desc = parts[3] || "";
  const active = parts[4] || "unknown";
  const sub = parts[5] || "unknown";
  const result = parts[6] || "unknown";
  const exitCode = Number(parts[7] || 0);
  const started = parseSystemdDate(parts[8]);
  const finished = parseSystemdDate(parts[9]);
  const next = parseSystemdDate(parts[10]);
  const command = extractCronCommand(desc);
  const schedule = extractCronSchedule(desc);
  const logFile = extractLogFile(desc);
  const running = active === "activating" || sub === "start" || active === "active";
  const durationSec = started ? Math.max(0, Math.round((Date.now() - Date.parse(started)) / 1000)) : undefined;
  const stuck = running && durationSec !== undefined && durationSec > config.jobStuckThresholdMin * 60;
  const status = stuck ? "stuck" : running ? "running" : result !== "success" || exitCode > 0 ? "failed" : "success";
  const name = command?.split("/").pop() || unit;
  return {
    name,
    unit,
    command,
    schedule,
    lastStart: started,
    lastFinish: finished,
    nextExpectedRun: next,
    status,
    durationSec: running ? durationSec : undefined,
    logFile,
    criticality: name.includes("fin") || name.includes("transactions") || name.includes("orders") || name.includes("sales") ? "high" : "medium",
    updatedAt: collectedAt
  };
};

const parseWorker = (parts: string[], collectedAt: string): WorkerState => {
  const unit = parts[1] || "unknown";
  const name = parts[2] || unit;
  const activeState = parts[3] || "unknown";
  const subState = parts[4] || "unknown";
  const restarts = Number(parts[5] || 0);
  const lastExitCode = Number(parts[6] || 0);
  const activeAt = parseSystemdDate(parts[7]);
  const uptimeSec = activeAt ? Math.max(0, Math.round((Date.now() - Date.parse(activeAt)) / 1000)) : undefined;
  const status = activeState === "failed" || lastExitCode > 0 ? "crit" : activeState !== "active" ? "warn" : restarts > 10 ? "warn" : "ok";
  return { unit, name, activeState, subState, status, uptimeSec, restarts, lastExitCode, updatedAt: collectedAt };
};

const parseLog = (parts: string[], config: AppConfig, collectedAt: string, topErrors: string[]): LogHeartbeat => {
  const mtimeSec = Number(parts[3] || 0);
  const lastWriteAt = mtimeSec > 0 ? new Date(mtimeSec * 1000).toISOString() : undefined;
  const ageMin = lastWriteAt ? (Date.now() - Date.parse(lastWriteAt)) / 60_000 : Number.POSITIVE_INFINITY;
  return {
    fileName: parts[1] || "unknown",
    path: parts[2] || "",
    lastWriteAt,
    sizeBytes: Number(parts[4] || 0),
    totalLines: Number(parts[5] || 0),
    linesPerMin: 0,
    errorCount: Number(parts[6] || 0),
    topErrors,
    stale: ageMin > config.logStaleThresholdMin,
    updatedAt: collectedAt
  };
};

const parseMetrics = (parts: string[], collectedAt: string): HostMetrics => {
  const memUsed = Number(parts[2] || 0);
  const memTotal = Number(parts[3] || 1);
  const swapUsed = Number(parts[4] || 0);
  const swapTotal = Number(parts[5] || 1);
  return {
    ts: collectedAt,
    cpuPct: round(Number(parts[1] || 0)),
    ramPct: round((memUsed / Math.max(memTotal, 1)) * 100),
    swapPct: round((swapUsed / Math.max(swapTotal, 1)) * 100),
    diskPct: round(Number(parts[6] || 0)),
    load1: Number(parts[7] || 0),
    load5: Number(parts[8] || 0),
    load15: Number(parts[9] || 0),
    topProcesses: []
  };
};

const emptyMetrics = (ts: string): HostMetrics => ({ ts, cpuPct: 0, ramPct: 0, diskPct: 0, swapPct: 0, load1: 0, load5: 0, load15: 0, topProcesses: [] });
const round = (value: number) => Math.round(value * 10) / 10;
const shellQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

const parseSystemdDate = (raw?: string): string | undefined => {
  if (!raw || raw === "n/a" || raw === "-") return undefined;
  const parsed = Date.parse(raw.replace(" MSK", "+03:00").replace(" UTC", "Z"));
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
};

const extractCronCommand = (desc: string): string | undefined => {
  const match = desc.match(/\/root\/projects\/silver_bullet\/[^\s"]+/);
  return match?.[0];
};

const extractCronSchedule = (desc: string): string | undefined => {
  const match = desc.match(/\[Cron\]\s+"?([^"]+)"/);
  if (!match) return undefined;
  return match[1].split(/\s+/).slice(0, 5).join(" ");
};

const extractLogFile = (desc: string): string | undefined => {
  const match = desc.match(/\/root\/projects\/silver_bullet\/logs\/([^\s"]+)/);
  return match?.[1];
};
