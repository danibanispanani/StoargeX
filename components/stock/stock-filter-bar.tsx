"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { operationalSearchParams } from "@/lib/operational-modules";
import type { StockView } from "@/lib/stock/stock-views";
import type { StockTableQuery } from "@/lib/stock/stock-table";

interface StockFilters {
  q: string;
  von: string;
  bis: string;
}

export function StockFilterBar({
  filters,
  activeView,
  tableQuery,
}: {
  filters: StockFilters;
  activeView: StockView;
  tableQuery: StockTableQuery;
}) {
  const router = useRouter();

  function apply(formData: FormData) {
    const query = operationalSearchParams({
      view: activeView === "standard" ? undefined : activeView,
      sort: tableQuery.sort === "number" ? undefined : tableQuery.sort,
      direction: tableQuery.direction === "desc" ? undefined : tableQuery.direction,
      q: String(formData.get("q") ?? "").trim() || undefined,
      von: String(formData.get("von") ?? "").trim() || undefined,
      bis: String(formData.get("bis") ?? "").trim() || undefined,
    });

    router.push(`/lager${query ? `?${query}` : ""}`);
  }

  return (
    <form
      action={apply}
      className="grid gap-2 border bg-card p-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_auto]"
    >
      <Input
        name="q"
        defaultValue={filters.q}
        placeholder="Artikel, Händler, Lager-Nr. oder EAN…"
        aria-label="Lager durchsuchen"
        className="self-end"
      />
      <label className="grid gap-1 text-xs text-muted-foreground">
        Von
        <Input name="von" type="date" defaultValue={filters.von} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Bis
        <Input name="bis" type="date" defaultValue={filters.bis} />
      </label>
      <Button type="submit" variant="outline" className="self-end">
        Filtern
      </Button>
    </form>
  );
}
