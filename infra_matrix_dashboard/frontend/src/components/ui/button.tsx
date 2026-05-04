import { cn } from "../../lib/utils";
import type { ButtonHTMLAttributes } from "react";

export const Button = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "rounded-md border border-matrix-green/35 bg-matrix-green/10 px-3 py-2 font-mono text-xs uppercase text-matrix-green transition hover:border-matrix-cyan hover:text-matrix-cyan disabled:opacity-50",
      className
    )}
    {...props}
  />
);
