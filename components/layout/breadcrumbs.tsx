"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { findNavigationItem } from "@/components/layout/app-navigation";

const SUBPAGE_LABELS: Record<string, string> = {
  sicherheit: "Sicherheit",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const item = findNavigationItem(pathname);
  if (!item) return null;

  const extraSegments = pathname
    .slice(item.href.length)
    .split("/")
    .filter(Boolean);

  return (
    <nav aria-label="Brotkrümeln" className="flex min-h-5 items-center gap-1 text-xs text-muted-foreground">
      {item.href === "/dashboard" ? (
        <span aria-current="page">Dashboard</span>
      ) : (
        <>
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <Link href={item.href} className="hover:text-foreground" aria-current={extraSegments.length ? undefined : "page"}>
            {item.shortLabel ?? item.label}
          </Link>
        </>
      )}
      {extraSegments.map((segment, index) => (
        <span key={segment} className="contents">
          <ChevronRight className="size-3" aria-hidden="true" />
          <span aria-current={index === extraSegments.length - 1 ? "page" : undefined}>
            {SUBPAGE_LABELS[segment] ?? segment}
          </span>
        </span>
      ))}
    </nav>
  );
}
