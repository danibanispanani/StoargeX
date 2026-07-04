"use client";

import { useRouter } from "next/navigation";
import { STOCK_STATUS_LABELS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Filter/Suche fürs Lager – schreibt Query-Parameter (server-seitig gefiltert). */
export function StockFilterBar({ q, status }: { q: string; status: string }) {
  const router = useRouter();

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    const query = String(formData.get("q") ?? "").trim();
    const st = String(formData.get("status") ?? "");
    if (query) params.set("q", query);
    if (st) params.set("status", st);
    router.push(`/lager${params.size ? `?${params}` : ""}`);
  }

  return (
    <form action={apply} className="flex flex-wrap items-end gap-2">
      <div className="w-64">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Suche: Titel, Modell, SKU, EAN, Händler…"
        />
      </div>
      <select
        name="status"
        defaultValue={status}
        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">Alle Status</option>
        {Object.entries(STOCK_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary">
        Filtern
      </Button>
      {(q || status) && (
        <Button type="button" variant="ghost" onClick={() => router.push("/lager")}>
          Zurücksetzen
        </Button>
      )}
    </form>
  );
}
