import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InsightItem {
  label: string;
  value: string;
  detail?: string;
  href?: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
}

const TONE_CLASS: Record<NonNullable<InsightItem["tone"]>, string> = {
  neutral: "border-l-rail text-foreground",
  positive: "border-l-transit-teal text-transit-teal",
  warning: "border-l-cargo-amber text-amber-700 dark:text-amber-300",
  critical: "border-l-customs-red text-destructive",
};

export function InsightStrip({ items }: { items: readonly InsightItem[] }) {
  return (
    <section
      aria-label="Operative Kennzahlen"
      className="grid border-y border-border/80 bg-muted/15 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => {
        const content = (
          <div
            key={item.href ? undefined : item.label}
            className={cn(
              "h-full border-l-2 px-3 py-2.5 sm:border-r sm:border-r-border/70",
              TONE_CLASS[item.tone ?? "neutral"]
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              {item.href ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : null}
            </div>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums">{item.value}</p>
            {item.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p> : null}
          </div>
        );

        return item.href ? (
          <Link key={item.label} href={item.href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            {content}
          </Link>
        ) : content;
      })}
    </section>
  );
}
