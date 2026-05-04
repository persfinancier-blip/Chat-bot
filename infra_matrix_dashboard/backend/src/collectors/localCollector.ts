import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppConfig, Snapshot } from "../types/models.js";
import { buildAlerts } from "../services/alerts.js";
import { buildCollectorScript, parseCollectorOutput } from "./sshCollector.js";

const execFileAsync = promisify(execFile);

export const collectLocalSnapshot = async (config: AppConfig): Promise<Snapshot> => {
  const collectedAt = new Date().toISOString();
  const errors: string[] = [];
  let stdout = "";

  try {
    const result = await execFileAsync("bash", ["-lc", buildCollectorScript(config.logsPath)], {
      timeout: 35_000,
      maxBuffer: 8 * 1024 * 1024
    });
    stdout = String(result.stdout || "");
    const stderr = String(result.stderr || "").trim();
    if (stderr) errors.push(stderr.slice(0, 1200));
  } catch (error) {
    const detail = error as { message?: string; stdout?: string | Buffer; stderr?: string | Buffer; code?: number };
    stdout = String(detail.stdout || "");
    if (detail.stderr) errors.push(String(detail.stderr).trim().slice(0, 1200));
    errors.push(`local collector failed${detail.code ? ` with exit code ${detail.code}` : ""}: ${detail.message || "unknown error"}`);
  }

  const parsed = parseCollectorOutput(stdout, config, collectedAt);
  const snapshot: Snapshot = {
    collectedAt,
    mode: "local",
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
