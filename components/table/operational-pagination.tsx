import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OperationalPagination({
  page,
  pageSize,
  totalResults,
  query,
}: {
  page: number;
  pageSize: number;
  totalResults: number;
  query: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const first = totalResults === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(totalResults, page * pageSize);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs" aria-label="Tabellenseiten">
      <span className="text-muted-foreground">
        {first}–{last} von {totalResults} Treffern
      </span>
      <div className="flex items-center gap-1">
        <PageLink page={page - 1} query={query} disabled={page <= 1} label="Vorherige Seite">
          <ChevronLeftIcon />
        </PageLink>
        <span className="min-w-20 text-center font-mono">
          {page} / {totalPages}
        </span>
        <PageLink page={page + 1} query={query} disabled={page >= totalPages} label="Nächste Seite">
          <ChevronRightIcon />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  page,
  query,
  disabled,
  label,
  children,
}: {
  page: number;
  query: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  return (
    <Link
      href={disabled ? "#" : `?${params}`}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      aria-label={label}
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-sm" }),
        disabled && "pointer-events-none opacity-45"
      )}
    >
      {children}
    </Link>
  );
}
