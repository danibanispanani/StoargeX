import type { PurchaseTableQuery } from "@/lib/purchases/purchase-table";
import { DEFAULT_TABLE_PAGE_SIZE } from "@/lib/operational-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PurchaseFilterBar({ query, suppliers }: {
  query: PurchaseTableQuery;
  suppliers: Array<{ id: string; label: string }>;
}) {
  return <form className="grid gap-2 border bg-card p-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_12rem_10rem_10rem_auto]">
      <Input name="q" defaultValue={query.q} placeholder="Einkauf, Lieferant, Artikel, Tracking…" aria-label="Einkäufe durchsuchen" />
      <select name="supplier" defaultValue={query.supplier} aria-label="Lieferant filtern" className="h-9 border bg-background px-2 text-sm"><option value="">Alle Lieferanten</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <Input name="from" type="date" defaultValue={query.from} aria-label="Bestelldatum von" />
      <Input name="to" type="date" defaultValue={query.to} aria-label="Bestelldatum bis" />
      <input type="hidden" name="preset" value={query.preset} />
      {query.pageSize !== DEFAULT_TABLE_PAGE_SIZE ? <input type="hidden" name="pageSize" value={query.pageSize} /> : null}
      <Button variant="outline">Filtern</Button>
    </form>;
}
