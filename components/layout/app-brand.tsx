import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex min-w-0 items-center gap-2 text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        collapsed && "mx-auto"
      )}
      aria-label="StorageX Dashboard"
    >
      <span className="grid size-8 shrink-0 place-items-center border border-transit-teal/50 bg-transit-teal/10 text-transit-teal">
        <PackageCheck className="size-4" aria-hidden="true" />
      </span>
      {!collapsed ? (
        <span className="min-w-0 leading-none">
          <span className="block truncate font-display text-sm font-semibold tracking-tight">StorageX</span>
          <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/45">
            Handelskonsole
          </span>
        </span>
      ) : null}
    </Link>
  );
}
