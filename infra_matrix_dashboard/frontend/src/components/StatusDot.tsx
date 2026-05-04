import { cn } from "../lib/utils";

export const StatusDot = ({ status }: { status: string }) => {
  const tone =
    status === "ok" || status === "success" || status === "active"
      ? "bg-matrix-green shadow-[0_0_12px_rgba(53,255,147,.8)]"
      : status === "warn" || status === "running" || status === "unknown"
        ? "bg-matrix-amber shadow-[0_0_12px_rgba(255,204,102,.75)]"
        : "bg-matrix-red shadow-[0_0_12px_rgba(255,77,109,.75)]";
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", tone)} />;
};
