import fs from "node:fs";
import path from "node:path";
import initSqlJs, { Database as SqlDatabase, SqlJsStatic } from "sql.js";
import type { AlertItem, HostMetrics, JobRun, LogHeartbeat, Snapshot, WorkerState } from "../types/models.js";

type SqlValue = string | number | null;

export class DashboardDb {
  private constructor(
    private readonly SQL: SqlJsStatic,
    private readonly db: SqlDatabase,
    private readonly dbPath: string
  ) {}

  static async open(dbPath: string): Promise<DashboardDb> {
    const SQL = await initSqlJs({
      locateFile: (file) => path.resolve(process.cwd(), "node_modules", "sql.js", "dist", file)
    });

    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    const resolved = path.resolve(dbPath);
    const db = fs.existsSync(resolved) ? new SQL.Database(fs.readFileSync(resolved)) : new SQL.Database();
    const instance = new DashboardDb(SQL, db, resolved);
    instance.migrate();
    instance.persist();
    return instance;
  }

  private migrate(): void {
    this.db.run(`
      create table if not exists job_runs (
        id integer primary key autoincrement,
        name text not null,
        unit text not null,
        command text,
        schedule text,
        last_start text,
        last_finish text,
        next_expected_run text,
        status text not null,
        duration_sec integer,
        log_file text,
        criticality text not null,
        updated_at text not null
      );
      create table if not exists worker_state (
        id integer primary key autoincrement,
        unit text not null,
        name text not null,
        active_state text not null,
        sub_state text not null,
        status text not null,
        uptime_sec integer,
        restarts integer,
        last_exit_code integer,
        updated_at text not null
      );
      create table if not exists log_heartbeat (
        id integer primary key autoincrement,
        file_name text not null,
        path text not null,
        last_write_at text,
        size_bytes integer not null,
        total_lines integer not null,
        lines_per_min real not null,
        error_count integer not null,
        top_errors_json text not null,
        stale integer not null,
        updated_at text not null
      );
      create table if not exists host_metrics (
        id integer primary key autoincrement,
        ts text not null,
        cpu_pct real not null,
        ram_pct real not null,
        disk_pct real not null,
        swap_pct real not null,
        load1 real not null,
        load5 real not null,
        load15 real not null,
        top_processes_json text not null
      );
      create table if not exists alerts (
        id text primary key,
        level text not null,
        type text not null,
        title text not null,
        message text not null,
        source text not null,
        created_at text not null,
        active integer not null
      );
    `);
  }

  persist(): void {
    fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
  }

  saveSnapshot(snapshot: Snapshot): void {
    this.db.run("delete from alerts where active = 1");
    snapshot.jobs.forEach((job) => this.insertJob(job));
    snapshot.workers.forEach((worker) => this.insertWorker(worker));
    snapshot.logs.forEach((log) => this.insertLog(log));
    this.insertMetrics(snapshot.metrics);
    snapshot.alerts.forEach((alert) => this.insertAlert(alert));
    this.persist();
  }

  private run(sql: string, params: SqlValue[] = []): void {
    this.db.run(sql, params);
  }

  private all<T>(sql: string, params: SqlValue[] = []): T[] {
    const stmt = this.db.prepare(sql, params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }

  private insertJob(job: JobRun): void {
    this.run(
      `insert into job_runs (name, unit, command, schedule, last_start, last_finish, next_expected_run, status, duration_sec, log_file, criticality, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [job.name, job.unit, job.command ?? null, job.schedule ?? null, job.lastStart ?? null, job.lastFinish ?? null, job.nextExpectedRun ?? null, job.status, job.durationSec ?? null, job.logFile ?? null, job.criticality, job.updatedAt]
    );
  }

  private insertWorker(worker: WorkerState): void {
    this.run(
      `insert into worker_state (unit, name, active_state, sub_state, status, uptime_sec, restarts, last_exit_code, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [worker.unit, worker.name, worker.activeState, worker.subState, worker.status, worker.uptimeSec ?? null, worker.restarts ?? null, worker.lastExitCode ?? null, worker.updatedAt]
    );
  }

  private insertLog(log: LogHeartbeat): void {
    this.run(
      `insert into log_heartbeat (file_name, path, last_write_at, size_bytes, total_lines, lines_per_min, error_count, top_errors_json, stale, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [log.fileName, log.path, log.lastWriteAt ?? null, log.sizeBytes, log.totalLines, log.linesPerMin, log.errorCount, JSON.stringify(log.topErrors), log.stale ? 1 : 0, log.updatedAt]
    );
  }

  private insertMetrics(metrics: HostMetrics): void {
    this.run(
      `insert into host_metrics (ts, cpu_pct, ram_pct, disk_pct, swap_pct, load1, load5, load15, top_processes_json)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [metrics.ts, metrics.cpuPct, metrics.ramPct, metrics.diskPct, metrics.swapPct, metrics.load1, metrics.load5, metrics.load15, JSON.stringify(metrics.topProcesses)]
    );
  }

  private insertAlert(alert: AlertItem): void {
    this.run(
      `insert or replace into alerts (id, level, type, title, message, source, created_at, active)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [alert.id, alert.level, alert.type, alert.title, alert.message, alert.source, alert.createdAt, alert.active ? 1 : 0]
    );
  }

  latestJobs(): JobRun[] {
    return this.all<any>(`
      select j.* from job_runs j
      join (select unit, max(id) id from job_runs group by unit) m on j.id = m.id
      order by case status when 'stuck' then 0 when 'failed' then 1 when 'running' then 2 when 'unknown' then 3 else 4 end, name
    `).map(mapJob);
  }

  latestWorkers(): WorkerState[] {
    return this.all<any>(`
      select w.* from worker_state w
      join (select unit, max(id) id from worker_state group by unit) m on w.id = m.id
      order by case status when 'crit' then 0 when 'warn' then 1 when 'unknown' then 2 else 3 end, unit
    `).map(mapWorker);
  }

  latestLogs(): LogHeartbeat[] {
    return this.all<any>(`
      select l.* from log_heartbeat l
      join (select path, max(id) id from log_heartbeat group by path) m on l.id = m.id
      order by stale desc, error_count desc, file_name
    `).map(mapLog);
  }

  activeAlerts(): AlertItem[] {
    return this.all<any>("select * from alerts where active = 1 order by case level when 'crit' then 0 when 'warn' then 1 else 2 end, created_at desc").map(mapAlert);
  }

  metricsHistory(limit = 120): HostMetrics[] {
    return this.all<any>("select * from host_metrics order by id desc limit ?", [limit]).reverse().map(mapMetrics);
  }
}

const mapJob = (row: any): JobRun => ({
  name: row.name,
  unit: row.unit,
  command: row.command ?? undefined,
  schedule: row.schedule ?? undefined,
  lastStart: row.last_start ?? undefined,
  lastFinish: row.last_finish ?? undefined,
  nextExpectedRun: row.next_expected_run ?? undefined,
  status: row.status,
  durationSec: row.duration_sec ?? undefined,
  logFile: row.log_file ?? undefined,
  criticality: row.criticality,
  updatedAt: row.updated_at
});

const mapWorker = (row: any): WorkerState => ({
  unit: row.unit,
  name: row.name,
  activeState: row.active_state,
  subState: row.sub_state,
  status: row.status,
  uptimeSec: row.uptime_sec ?? undefined,
  restarts: row.restarts ?? undefined,
  lastExitCode: row.last_exit_code ?? undefined,
  updatedAt: row.updated_at
});

const mapLog = (row: any): LogHeartbeat => ({
  fileName: row.file_name,
  path: row.path,
  lastWriteAt: row.last_write_at ?? undefined,
  sizeBytes: row.size_bytes,
  totalLines: row.total_lines,
  linesPerMin: row.lines_per_min,
  errorCount: row.error_count,
  topErrors: JSON.parse(row.top_errors_json || "[]"),
  stale: Boolean(row.stale),
  updatedAt: row.updated_at
});

const mapMetrics = (row: any): HostMetrics => ({
  ts: row.ts,
  cpuPct: row.cpu_pct,
  ramPct: row.ram_pct,
  diskPct: row.disk_pct,
  swapPct: row.swap_pct,
  load1: row.load1,
  load5: row.load5,
  load15: row.load15,
  topProcesses: JSON.parse(row.top_processes_json || "[]")
});

const mapAlert = (row: any): AlertItem => ({
  id: row.id,
  level: row.level,
  type: row.type,
  title: row.title,
  message: row.message,
  source: row.source,
  createdAt: row.created_at,
  active: Boolean(row.active)
});
