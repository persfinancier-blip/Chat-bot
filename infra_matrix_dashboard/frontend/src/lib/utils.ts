import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const fmtPct = (value?: number) => `${Math.round(value ?? 0)}%`;
export const fmtDuration = (sec?: number) => {
  if (!sec) return "н/д";
  if (sec < 60) return `${sec} с`;
  if (sec < 3600) return `${Math.round(sec / 60)} мин`;
  return `${Math.round(sec / 3600)} ч`;
};

export const fmtTime = (value?: string) => {
  if (!value) return "неизвестно";
  return new Date(value).toLocaleString();
};
