import type { AlertLevel } from "./api";

export const GLOBAL_CONTROL_SETTINGS_KEY = "silver-bullet-matrix-global-control-settings";

export type IncidentSeverity = "critical" | "warn" | "info";

export interface GlobalControlSettings {
  healthCore: {
    enabled: boolean;
    showRing: boolean;
    showScore: boolean;
    showScoreLabel: boolean;
    showLastCollection: boolean;
  };
  incidents: {
    enabled: boolean;
    showSeverity: boolean;
    showSourceName: boolean;
    showDescription: boolean;
    maxItems: number;
    severities: IncidentSeverity[];
    sources: string[];
  };
  criticalJobs: {
    enabled: boolean;
    selectedJobs: string[];
    showFailed: boolean;
    showStuck: boolean;
  };
  criticalWorkers: {
    enabled: boolean;
    selectedWorkers: string[];
    selectedServices: string[];
  };
  staleLogs: {
    enabled: boolean;
    selectedLogs: string[];
    thresholdMin: number | null;
  };
  cpuRam: {
    enabled: boolean;
    showCpu: boolean;
    showRam: boolean;
    showLoad: boolean;
    showProgress: boolean;
  };
  telemetryContract: {
    enabled: boolean;
    showPolling: boolean;
    showStorage: boolean;
    showAlerts: boolean;
    showMode: boolean;
  };
}

export const defaultGlobalControlSettings: GlobalControlSettings = {
  healthCore: {
    enabled: true,
    showRing: true,
    showScore: true,
    showScoreLabel: true,
    showLastCollection: true
  },
  incidents: {
    enabled: true,
    showSeverity: true,
    showSourceName: true,
    showDescription: true,
    maxItems: 12,
    severities: ["critical", "warn", "info"],
    sources: []
  },
  criticalJobs: {
    enabled: true,
    selectedJobs: [],
    showFailed: true,
    showStuck: true
  },
  criticalWorkers: {
    enabled: true,
    selectedWorkers: [],
    selectedServices: []
  },
  staleLogs: {
    enabled: true,
    selectedLogs: [],
    thresholdMin: null
  },
  cpuRam: {
    enabled: true,
    showCpu: true,
    showRam: true,
    showLoad: true,
    showProgress: true
  },
  telemetryContract: {
    enabled: true,
    showPolling: true,
    showStorage: true,
    showAlerts: true,
    showMode: true
  }
};

export const loadGlobalControlSettings = (): GlobalControlSettings => {
  if (typeof window === "undefined") return cloneDefaultSettings();
  const raw = window.localStorage.getItem(GLOBAL_CONTROL_SETTINGS_KEY);
  if (!raw) return cloneDefaultSettings();

  try {
    return mergeSettings(cloneDefaultSettings(), JSON.parse(raw) as Partial<GlobalControlSettings>);
  } catch {
    return cloneDefaultSettings();
  }
};

export const saveGlobalControlSettings = (settings: GlobalControlSettings): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GLOBAL_CONTROL_SETTINGS_KEY, JSON.stringify(settings));
};

export const cloneDefaultSettings = (): GlobalControlSettings => JSON.parse(JSON.stringify(defaultGlobalControlSettings)) as GlobalControlSettings;

export const severityFromAlertLevel = (level: AlertLevel): IncidentSeverity => (level === "crit" ? "critical" : level);

const mergeSettings = <T extends object>(defaults: T, saved: Partial<T>): T => {
  const merged = { ...(defaults as Record<string, unknown>) };
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    const defaultValue = merged[key];
    if (Array.isArray(defaultValue)) {
      merged[key] = Array.isArray(value) ? value : defaultValue;
    } else if (isObject(defaultValue) && isObject(value)) {
      merged[key] = mergeSettings(defaultValue, value as Partial<typeof defaultValue>);
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as T;
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
