"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZES,
  parseTablePageSize,
  type TablePageSize,
} from "@/lib/operational-table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OperationalPagination({
  page,
  pageSize,
  totalResults,
  query,
}: {
  page: number;
  pageSize: TablePageSize;
  totalResults: number;
  query: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const totalPages = totalPageCount(totalResults, pageSize);

  function changePageSize(nextPageSize: TablePageSize) {
    const params = new URLSearchParams(query);
    params.delete("page");
    if (nextPageSize === DEFAULT_TABLE_PAGE_SIZE) params.delete("pageSize");
    else params.set("pageSize", String(nextPageSize));
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  return (
    <PaginationFrame
      page={page}
      pageSize={pageSize}
      totalResults={totalResults}
      onPageSizeChange={changePageSize}
      previousControl={
        <PageLink page={page - 1} query={query} disabled={page <= 1} label="Vorherige Seite">
          <ChevronLeftIcon />
        </PageLink>
      }
      nextControl={
        <PageLink page={page + 1} query={query} disabled={page >= totalPages} label="Nächste Seite">
          <ChevronRightIcon />
        </PageLink>
      }
    />
  );
}

export function ClientOperationalPagination({
  page,
  pageSize,
  totalResults,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: TablePageSize;
  totalResults: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: TablePageSize) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));

  return (
    <PaginationFrame
      page={page}
      pageSize={pageSize}
      totalResults={totalResults}
      onPageSizeChange={onPageSizeChange}
      previousControl={
        <button
          type="button"
          disabled={page <= 1}
          aria-label="Vorherige Seite"
          onClick={() => onPageChange(page - 1)}
          className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "disabled:pointer-events-none disabled:opacity-45")}
        >
          <ChevronLeftIcon />
        </button>
      }
      nextControl={
        <button
          type="button"
          disabled={page >= totalPages}
          aria-label="Nächste Seite"
          onClick={() => onPageChange(page + 1)}
          className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "disabled:pointer-events-none disabled:opacity-45")}
        >
          <ChevronRightIcon />
        </button>
      }
    />
  );
}

function PaginationFrame({
  page,
  pageSize,
  totalResults,
  onPageSizeChange,
  previousControl,
  nextControl,
}: {
  page: number;
  pageSize: TablePageSize;
  totalResults: number;
  onPageSizeChange: (pageSize: TablePageSize) => void;
  previousControl: React.ReactNode;
  nextControl: React.ReactNode;
}) {
  const totalPages = totalPageCount(totalResults, pageSize);
  const first = totalResults === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(totalResults, page * pageSize);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs" aria-label="Tabellenseiten">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground">{first}–{last} von {totalResults} Treffern</span>
        <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
      </div>
      <div className="flex items-center gap-1">
        {previousControl}
        <span className="min-w-20 text-center font-mono">{page} / {totalPages}</span>
        {nextControl}
      </div>
    </nav>
  );
}

function PageSizeSelect({
  value,
  onChange,
}: {
  value: TablePageSize;
  onChange: (value: TablePageSize) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-muted-foreground">
      Zeilen
      <select
        value={value}
        onChange={(event) => onChange(parseTablePageSize(event.target.value))}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
        aria-label="Zeilen pro Seite"
      >
        {TABLE_PAGE_SIZES.map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
    </label>
  );
}

function totalPageCount(totalResults: number, pageSize: TablePageSize) {
  return Math.max(1, Math.ceil(totalResults / pageSize));
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
