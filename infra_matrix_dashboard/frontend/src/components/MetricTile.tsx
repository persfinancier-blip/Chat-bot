import type { LucideIcon } from "lucide-react";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";

export const MetricTile = ({
  icon: Icon,
  label,
  value,
  hint,
  percent,
  tone = "ok"
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  percent?: number;
  tone?: "ok" | "warn" | "crit";
}) => (
  <Card className="min-h-[126px]">
    <div className="flex items-start justify-between">
      <div>
        <div className="font-mono text-xs uppercase text-white/45">{label}</div>
        <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
      </div>
      <Icon className="h-5 w-5 text-matrix-cyan" />
    </div>
    <div className="mt-3 text-xs text-white/55">{hint}</div>
    {percent !== undefined ? <div className="mt-3"><Progress value={percent} tone={tone} /></div> : null}
  </Card>
);
