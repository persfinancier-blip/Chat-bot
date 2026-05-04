import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import type { AppConfig } from "./types/models.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const numberEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const loadConfig = (): AppConfig => {
  const keyPath = process.env.SSH_KEY_PATH || undefined;
  return {
    appEnv: process.env.APP_ENV === "prod" ? "prod" : "dev",
    collectorMode: parseCollectorMode(process.env.COLLECTOR_MODE),
    apiHost: process.env.API_HOST || "127.0.0.1",
    apiPort: numberEnv("API_PORT", 8787),
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173",
    pollIntervalSec: numberEnv("POLL_INTERVAL_SEC", 30),
    logStaleThresholdMin: numberEnv("LOG_STALE_THRESHOLD_MIN", 10),
    jobStuckThresholdMin: numberEnv("JOB_STUCK_THRESHOLD_MIN", 180),
    logsPath: process.env.LOGS_PATH || "/projects/silver_bullet/logs",
    ssh: {
      host: process.env.SSH_HOST || undefined,
      port: numberEnv("SSH_PORT", 22),
      user: process.env.SSH_USER || undefined,
      password: process.env.SSH_PASSWORD || undefined,
      keyPath: keyPath && fs.existsSync(keyPath) ? keyPath : keyPath
    }
  };
};

const parseCollectorMode = (raw?: string): AppConfig["collectorMode"] => {
  if (raw === "mock" || raw === "ssh" || raw === "local") return raw;
  return "auto";
};

export const hasSshConfig = (config: AppConfig): boolean => {
  return Boolean(config.ssh.host && config.ssh.user && (config.ssh.password || config.ssh.keyPath));
};

export const redact = (value: string): string => {
  return value.replace(
    /(PASSWORD|PASS|TOKEN|KEY|SECRET|HASH|DATABASE_URL|PGPASSWORD|SSH_PRIVATE_KEY|GOOGLE_SERVICE_ACCOUNT_JSON|TELEGRAM_API_HASH)=\S+/gi,
    "$1=<redacted>"
  );
};
