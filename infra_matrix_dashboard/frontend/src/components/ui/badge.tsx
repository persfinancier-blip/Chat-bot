import { cn } from "../../lib/utils";
import type { PropsWithChildren } from "react";

const tones = {
  ok: "border-matrix-green/50 bg-matrix-green/10 text-matrix-green",
  warn: "border-matrix-amber/50 bg-matrix-amber/10 text-matrix-amber",
  crit: "border-matrix-red/60 bg-matrix-red/10 text-matrix-red",
  info: "border-matrix-cyan/50 bg-matrix-cyan/10 text-matrix-cyan",
  unknown: "border-white/20 bg-white/5 text-white/70"
};

export const Badge = ({ tone = "info", children, className }: PropsWithChildren<{ tone?: keyof typeof tones; className?: string }>) => (
  <span className={cn("inline-flex items-center rounded border px-2 py-0.5 font-mono text-[11px] uppercase", tones[tone], className)}>
    {children}
  </span>
);
