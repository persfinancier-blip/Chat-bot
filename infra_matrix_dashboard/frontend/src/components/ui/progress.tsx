import { cn } from "../../lib/utils";

export const Progress = ({ value, tone = "ok" }: { value: number; tone?: "ok" | "warn" | "crit" }) => {
  const color = tone === "crit" ? "bg-matrix-red" : tone === "warn" ? "bg-matrix-amber" : "bg-matrix-green";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
};
