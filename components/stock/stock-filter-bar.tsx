"use client";

import { useRouter } from "next/navigation";
import {
  ENTRY_STATUS_TITLES,
  KAUF_STATUS_OPTIONS,
  RETOURE_STATUS_OPTIONS,
  STOCK_STATUS,
  STOCK_STATUS_OPTIONS,
} from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface StockFilters {
  q: string;
  status: string;
  kauf: string;
  retoure: string;
  zm: string;
  plattform: string;
  von: string;
  bis: string;
}

/** Filter fürs Lager: Status, Kauf, Retoure, Datum, Plattform, ZM, Suche. */
export function StockFilterBar({
  filters,
  platforms,
  zmOptions,
  activeView,
}: {
  filters: StockFilters;
  platforms: Array<{ id: string; name: string }>;
  zmOptions: string[];
  activeView?: string;
}) {
  const router = useRouter();
  const hasFilters = Object.values(filters).some(Boolean);

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    if (activeView && activeView !== "standard") params.set("view", activeView);
    for (const key of ["q", "status", "kauf", "retoure", "zm", "plattform", "von", "bis"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    router.push(`/lager${params.size ? `?${params}` : ""}`);
  }

  const selectClass =
    "border-input h-9 rounded-md border bg-background px-2 text-sm";

  return (
    <form action={apply} className="flex flex-wrap items-end gap-2">
      <Input
        name="q"
        defaultValue={filters.q}
        placeholder="Suche: Model, Händler, LagerID, EAN…"
        className="w-56"
      />
      <select name="status" defaultValue={filters.status} className={selectClass}>
        <option value="">Alle Status</option>
        {STOCK_STATUS_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {STOCK_STATUS[value].label}
          </option>
        ))}
      </select>
      <select name="kauf" defaultValue={filters.kauf} className={selectClass}>
        <option value="">Kauf: alle</option>
        {KAUF_STATUS_OPTIONS.map((value) => (
          <option key={value} value={value}>
            Kauf: {value} ({ENTRY_STATUS_TITLES[value]})
          </option>
        ))}
      </select>
      <select name="retoure" defaultValue={filters.retoure} className={selectClass}>
        <option value="">Retoure: alle</option>
        {RETOURE_STATUS_OPTIONS.map((value) => (
          <option key={value} value={value}>
            Retoure: {value} ({ENTRY_STATUS_TITLES[value]})
          </option>
        ))}
      </select>
      <select name="zm" defaultValue={filters.zm} className={selectClass}>
        <option value="">ZM: alle</option>
        {zmOptions.map((zm) => (
          <option key={zm} value={zm}>
            ZM: {zm}
          </option>
        ))}
      </select>
      <select name="plattform" defaultValue={filters.plattform} className={selectClass}>
        <option value="">Gelistet: egal</option>
        {platforms.map((p) => (
          <option key={p.id} value={p.id}>
            Gelistet auf {p.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm text-muted-foreground">
        Von
        <Input name="von" type="date" defaultValue={filters.von} className="w-36" />
      </label>
      <label className="flex items-center gap-1 text-sm text-muted-foreground">
        Bis
        <Input name="bis" type="date" defaultValue={filters.bis} className="w-36" />
      </label>
      <Button type="submit" variant="secondary">
        Filtern
      </Button>
      {hasFilters && (
        <Button type="button" variant="ghost" onClick={() => router.push(activeView && activeView !== "standard" ? `/lager?view=${activeView}` : "/lager")}>
          Zurücksetzen
        </Button>
      )}
    </form>
  );
}
