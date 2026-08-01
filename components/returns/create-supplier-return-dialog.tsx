"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createSupplierReturnAction } from "@/lib/actions/supplier-returns";
import type { ActionState } from "@/lib/actions/team";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inventoryBucketLabel } from "@/lib/inventory-labels";
import { ITEM_CONDITION_OPTIONS } from "@/lib/item-condition-options";

export interface SupplierReturnPurchaseOption {
  id: string;
  label: string;
  search: string;
  returnDeadline: string | null;
  lines: Array<{
    id: string;
    label: string;
    positions: Array<{
      id: string;
      inventoryNumber: string;
      itemCondition: string | null;
      buckets: Array<{ key: "AVAILABLE" | "RESERVED" | "INSPECTION" | "DEFECTIVE"; quantity: number }>;
    }>;
  }>;
}

export function CreateSupplierReturnDialog({
  purchases,
}: {
  purchases: SupplierReturnPurchaseOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [purchaseId, setPurchaseId] = useState(purchases[0]?.id ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createSupplierReturnAction,
    null
  );

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      setQuantities({});
      setReasons({});
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [state]);

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-DE");
    return purchases
      .filter((purchase) => !needle || purchase.search.toLocaleLowerCase("de-DE").includes(needle))
      .slice(0, 30);
  }, [purchases, query]);
  const selected = purchases.find((purchase) => purchase.id === purchaseId);
  const selectedCount = Object.values(quantities).filter((quantity) => quantity > 0).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Lieferantenretoure planen</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Lieferantenretoure planen</DialogTitle>
          <DialogDescription>
            Einkauf, konkrete Lots und Bestands-Buckets auswählen. Erst „Versenden“ bucht die Menge aus dem Bestand.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          {state?.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="supplier-return-search" label="Einkauf suchen" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="E-Nummer, Lieferant, Artikel" />
            <div className="space-y-2">
              <Label htmlFor="supplier-return-purchase">Einkauf</Label>
              <select
                id="supplier-return-purchase"
                name="purchaseId"
                value={purchaseId}
                onChange={(event) => {
                  setPurchaseId(event.target.value);
                  setQuantities({});
                  setReasons({});
                }}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
                required
              >
                {matches.map((purchase) => <option key={purchase.id} value={purchase.id}>{purchase.label}</option>)}
              </select>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Positionen, Lots und Mengen</h3>
            {selected?.lines.flatMap((line) => line.positions.map((position) => (
              <div key={position.id} className="border p-3">
                <div className="font-medium">{line.label}</div>
                <div className="font-mono text-xs text-muted-foreground">{position.inventoryNumber}</div>
                <div className="mt-3 space-y-2">
                  {position.buckets.filter((bucket) => bucket.quantity > 0).map((bucket) => {
                    const key = `${position.id}:${bucket.key}`;
                    const quantity = quantities[key] ?? 0;
                    return (
                      <div key={key} className="grid gap-2 bg-muted/35 p-2 sm:grid-cols-[8rem_7rem_1fr]">
                        <div className="text-sm"><strong>{inventoryBucketLabel(bucket.key)}</strong><div className="text-xs text-muted-foreground">verfügbar {bucket.quantity}</div></div>
                        <Input type="number" min={0} max={bucket.quantity} value={quantity} onChange={(event) => setQuantities((current) => ({ ...current, [key]: Math.min(bucket.quantity, Math.max(0, Number(event.target.value) || 0)) }))} aria-label={`Menge ${position.inventoryNumber} ${inventoryBucketLabel(bucket.key)}`} />
                        <Input value={reasons[key] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [key]: event.target.value }))} placeholder="Rückgabegrund" aria-label={`Rückgabegrund ${position.inventoryNumber}`} required={quantity > 0} />
                        {quantity > 0 && <>
                          <input type="hidden" name="purchaseLineIds" value={line.id} />
                          <input type="hidden" name="inventoryPositionIds" value={position.id} />
                          <input type="hidden" name="sourceBuckets" value={bucket.key} />
                          <input type="hidden" name="quantities" value={quantity} />
                          <input type="hidden" name="reasons" value={reasons[key] ?? ""} />
                          <label className="space-y-1 text-xs text-muted-foreground sm:col-start-3">
                            Artikelzustand
                            <select
                              name="itemConditions"
                              defaultValue={position.itemCondition ?? ""}
                              className="border-input mt-1 h-9 w-full border bg-background px-2 text-sm text-foreground"
                              aria-label={`Artikelzustand ${position.inventoryNumber}`}
                            >
                              <option value="">Nicht festgelegt</option>
                              {ITEM_CONDITION_OPTIONS.map((condition) => (
                                <option key={condition.value} value={condition.value}>{condition.label}</option>
                              ))}
                            </select>
                          </label>
                        </>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))) ?? <p className="text-sm text-muted-foreground">Keine rückgabefähigen Lots gefunden.</p>}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Field id="supplier-return-requested" name="requestedAt" label="Meldedatum" type="date" defaultValue={today} />
            <Field key={selected?.id ?? "no-purchase"} id="supplier-return-deadline" name="returnDeadline" label="Rückgabefrist" type="date" defaultValue={selected?.returnDeadline ?? ""} />
            <Field id="supplier-return-rma" name="rmaNumber" label="RMA-/Referenznummer" placeholder="optional" />
            <Field id="supplier-return-expected" name="expectedRefund" label="Erwartete Erstattung (€)" inputMode="decimal" placeholder="0,00" />
            <Field id="supplier-return-shipping" name="shippingCost" label="Versandkosten (€)" inputMode="decimal" placeholder="0,00" />
            <Field id="supplier-return-notes" name="notes" label="Notizen" placeholder="optional" />
            <Field id="supplier-return-documents" name="documentUrls" label="Dokumente / Belege (URLs)" placeholder="eine URL je Zeile" />
            <Field id="supplier-return-evidence" name="evidenceUrls" label="Bilder / Nachweise (URLs)" placeholder="eine URL je Zeile" />
          </section>

          <Button type="submit" className="w-full" disabled={pending || !selected || selectedCount === 0 || !idempotencyKey}>
            {pending ? "Wird geplant…" : "Lieferantenretoure planen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, ...props }: React.ComponentProps<typeof Input> & { id: string; label: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} {...props} /></div>;
}
