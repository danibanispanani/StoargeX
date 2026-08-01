"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/operational-table";

export interface SaleFilters {
  q: string;
  status: string;
  rechnung: string;
  platform: string;
  versandart: string;
  von: string;
  bis: string;
}

export function SaleFilterBar({
  filters,
  platforms,
  shippingMethods,
  activeView,
  pageSize,
}: {
  filters: SaleFilters;
  platforms: Array<{ id: string; name: string }>;
  shippingMethods: string[];
  activeView?: string;
  pageSize: TablePageSize;
}) {
  const router = useRouter();
  const hasFilters = Object.values(filters).some(Boolean);

  function apply(formData: FormData) {
    const params = createBaseParams(activeView, pageSize);
    for (const key of ["q", "status", "rechnung", "platform", "versandart", "von", "bis"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    router.push(`/verkauf${params.size ? `?${params}` : ""}`);
  }

  const selectClass =
    "border-input h-9 rounded-md border bg-background px-2 text-sm";

  return (
    <form action={apply} className="flex flex-wrap items-end gap-2">
      <Input
        name="q"
        defaultValue={filters.q}
        placeholder="Suche: Order-ID, Model, LagerID…"
        className="w-56"
      />
      <select name="status" defaultValue={filters.status} className={selectClass}>
        <option value="">Gesamtstatus: alle</option>
        <option value="PENDING">in Bearbeitung</option>
        <option value="COMPLETED">Abgeschlossen</option>
      </select>
      <select name="rechnung" defaultValue={filters.rechnung} className={selectClass}>
        <option value="">Rechnung: alle</option>
        <option value="offen">Rechnung: Offen</option>
        <option value="erledigt">Rechnung: Erledigt</option>
      </select>
      <select name="platform" defaultValue={filters.platform} className={selectClass}>
        <option value="">Alle Plattformen</option>
        {platforms.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select name="versandart" defaultValue={filters.versandart} className={selectClass}>
        <option value="">Versandart: alle</option>
        {shippingMethods.map((method) => (
          <option key={method} value={method}>
            {method}
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
        <Button type="button" variant="ghost" onClick={() => {
          const params = createBaseParams(activeView, pageSize);
          router.push(`/verkauf${params.size ? `?${params}` : ""}`);
        }}>
          Zurücksetzen
        </Button>
      )}
    </form>
  );
}

function createBaseParams(activeView: string | undefined, pageSize: TablePageSize) {
  const params = new URLSearchParams();
  if (activeView && activeView !== "standard") params.set("preset", activeView);
  if (pageSize !== DEFAULT_TABLE_PAGE_SIZE) params.set("pageSize", String(pageSize));
  return params;
}
