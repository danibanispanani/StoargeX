import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageToolbar({
  primary,
  secondary,
  className,
}: {
  primary?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-10 flex-wrap items-center justify-between gap-2 border-y bg-muted/20 px-2 py-1.5",
        className
      )}
      role="toolbar"
      aria-label="Seitenwerkzeuge"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{primary}</div>
      {secondary ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5">{secondary}</div>
      ) : null}
    </div>
  );
}
