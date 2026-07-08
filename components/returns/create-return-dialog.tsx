"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createReturnAction } from "@/lib/actions/returns";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface ReturnableSaleOption {
  id: string;
  label: string;
  search: string;
  lines: Array<{
    id: string;
    label: string;
    quantity: number;
    allocations: Array<{
      id: string;
      label: string;
      sold: number;
      returned: number;
      returnable: number;
    }>;
  }>;
}

export function CreateReturnDialog({
  sales,
}: {
  sales: ReturnableSaleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saleId, setSaleId] = useState(sales[0]?.id ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createReturnAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      setQuantities({});
    }
  }, [state]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sales.slice(0, 20);
    return sales
      .filter((sale) => sale.search.toLowerCase().includes(needle))
      .slice(0, 20);
  }, [query, sales]);
  const selectedSale = sales.find((sale) => sale.id === saleId);
  const selectedCount = Object.values(quantities).filter((quantity) => quantity > 0).length;
  const today = new Date().toISOString().slice(0, 10);

  function setQuantity(allocationId: string, quantity: number, max: number) {
    setQuantities((current) => ({
      ...current,
      [allocationId]: Math.min(Math.max(0, quantity || 0), max),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Retoure erfassen</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Retoure erfassen</DialogTitle>
          <DialogDescription>
            Verkauf auswählen, retournierbare Positionen markieren und Menge
            erfassen. Es werden keine LagerIDs manuell eingegeben.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-5">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <section className="space-y-2">
            <Label htmlFor="return-sale-search">1. Verkauf suchen</Label>
            <Input
              id="return-sale-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="V-Nummer, Produkt, Plattform, Datum…"
            />
            <select
              name="saleId"
              value={saleId}
              onChange={(event) => {
                setSaleId(event.target.value);
                setQuantities({});
              }}
              required
              className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {matches.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.label}
                </option>
              ))}
            </select>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">2./3. Positionen und Menge</h3>
            {!selectedSale && (
              <p className="text-sm text-muted-foreground">
                Kein Verkauf mit retournierbaren neuen SaleLines gefunden.
              </p>
            )}
            {selectedSale?.lines.map((line) => (
              <div key={line.id} className="rounded-md border p-3">
                <div className="font-medium">{line.label}</div>
                <div className="text-xs text-muted-foreground">
                  gekauft: {line.quantity}
                </div>
                <div className="mt-3 space-y-2">
                  {line.allocations.map((allocation) => {
                    const quantity = quantities[allocation.id] ?? 0;
                    return (
                      <div
                        key={allocation.id}
                        className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-[1fr_8rem]"
                      >
                        <div className="text-sm">
                          <div className="font-mono text-xs">{allocation.label}</div>
                          <div className="text-xs text-muted-foreground">
                            gekauft: {allocation.sold} · bereits retourniert:{" "}
                            {allocation.returned} · noch retournierbar:{" "}
                            {allocation.returnable}
                          </div>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={allocation.returnable}
                          value={quantity}
                          disabled={allocation.returnable <= 0}
                          onChange={(event) =>
                            setQuantity(
                              allocation.id,
                              Number(event.target.value),
                              allocation.returnable
                            )
                          }
                        />
                        {quantity > 0 && (
                          <>
                            <input type="hidden" name="allocationIds" value={allocation.id} />
                            <input type="hidden" name="quantities" value={quantity} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">4. Problem und Finanzen</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ret-date" name="requestedAt" label="Meldedatum" type="date" defaultValue={today} />
              <Field id="ret-problem" name="problemType" label="Problemart" placeholder="Defekt / Widerruf / Falschlieferung" />
              <Field id="ret-reason" name="reason" label="Ursache" placeholder="kurze Ursache" />
              <Field id="ret-condition" name="condition" label="Disposition" placeholder="Prüfung / verkaufbar / defekt" />
              <Field id="ret-refund" name="refundAmount" label="Erstattungsbetrag (€)" inputMode="decimal" placeholder="119,00" />
              <Field id="ret-extra" name="extraCost" label="Zusatzkosten (€)" inputMode="decimal" placeholder="4,50" />
            </div>
            <Field id="ret-notes" name="notes" label="Kommentar" placeholder="optional" />
          </section>

          <Button
            type="submit"
            className="w-full"
            disabled={pending || !selectedSale || selectedCount === 0}
          >
            {pending ? "Wird gespeichert…" : "Retoure angekündigt erfassen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  name,
  label,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  name: string;
  label: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...props} />
    </div>
  );
}
