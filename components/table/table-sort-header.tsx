import Link from "next/link";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function TableSortHeader({
  label,
  column,
  currentSort,
  direction,
  query,
  className,
}: {
  label: string;
  column: string;
  currentSort: string;
  direction: "asc" | "desc";
  query: string;
  className?: string;
}) {
  const params = new URLSearchParams(query);
  const active = currentSort === column;
  params.set("sort", column);
  params.set("direction", active && direction === "asc" ? "desc" : "asc");
  params.delete("page");
  const Icon = !active ? ArrowUpDownIcon : direction === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <Link
      href={`?${params}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm text-left hover:text-primary focus-visible:outline-none",
        active && "text-primary",
        className
      )}
      aria-label={`${label} ${active && direction === "asc" ? "absteigend" : "aufsteigend"} sortieren`}
    >
      {label}
      <Icon className="size-3.5" aria-hidden="true" />
    </Link>
  );
}
