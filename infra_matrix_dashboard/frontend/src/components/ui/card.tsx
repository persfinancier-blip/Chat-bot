import { cn } from "../../lib/utils";
import type { PropsWithChildren } from "react";

export const Card = ({ className, children }: PropsWithChildren<{ className?: string }>) => (
  <section className={cn("matrix-panel rounded-lg p-4", className)}>{children}</section>
);

export const CardHeader = ({ className, children }: PropsWithChildren<{ className?: string }>) => (
  <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>{children}</div>
);

export const CardTitle = ({ className, children }: PropsWithChildren<{ className?: string }>) => (
  <h2 className={cn("font-mono text-sm uppercase tracking-wider text-matrix-green", className)}>{children}</h2>
);
