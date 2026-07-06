import { cn } from "@/lib/utils";
import type { StatusStyle } from "@/lib/constants";

/** Einheitlich farbcodiertes Status-Tag (hell + dunkel). */
export function StatusBadge({
  style,
  className,
}: {
  style: StatusStyle;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}
