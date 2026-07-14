import Link from "next/link";
import { PURCHASE_TABLE_DEFINITION, type PurchaseTableQuery } from "@/lib/purchases/purchase-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PurchaseFilterBar({ query, suppliers, paymentAccounts }: {
  query: PurchaseTableQuery;
  suppliers: Array<{ id: string; label: string }>;
  paymentAccounts: Array<{ id: string; label: string }>;
}) {
  return <div className="space-y-3 border bg-card p-3">
    <div className="flex flex-wrap gap-1" aria-label="Einkaufsansichten">
      {PURCHASE_TABLE_DEFINITION.presets.map((preset) => {
        const params = new URLSearchParams();
        if (preset.key !== "standard") params.set("preset", preset.key);
        return <Link key={preset.key} href={`?${params}`} className={cn(buttonVariants({ variant: query.preset === preset.key ? "default" : "outline", size: "sm" }))}>{preset.label}</Link>;
      })}
    </div>
    <form className="grid gap-2 md:grid-cols-[minmax(14rem,1fr)_12rem_12rem_10rem_10rem_auto]">
      <Input name="q" defaultValue={query.q} placeholder="Einkauf, Lieferant, Artikel, Tracking…" aria-label="Einkäufe durchsuchen" />
      <select name="supplier" defaultValue={query.supplier} aria-label="Lieferant filtern" className="h-9 border bg-background px-2 text-sm"><option value="">Alle Lieferanten</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <select name="paymentAccount" defaultValue={query.paymentAccount} aria-label="Zahlungskonto filtern" className="h-9 border bg-background px-2 text-sm"><option value="">Alle Konten</option>{paymentAccounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <Input name="from" type="date" defaultValue={query.from} aria-label="Bestelldatum von" />
      <Input name="to" type="date" defaultValue={query.to} aria-label="Bestelldatum bis" />
      <input type="hidden" name="preset" value={query.preset} />
      <Button variant="outline">Filtern</Button>
    </form>
  </div>;
}
