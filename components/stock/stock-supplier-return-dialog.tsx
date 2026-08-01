"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createSupplierReturnFromStockAction,
  type StockSupplierReturnActionState,
} from "@/lib/actions/supplier-returns";
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

export function StockSupplierReturnDialog({
  inventoryPositionId,
  inventoryNumber,
  productName,
  supplier,
  purchaseNumber,
  returnableQuantity,
}: {
  inventoryPositionId: string;
  inventoryNumber: string;
  productName: string;
  supplier: string;
  purchaseNumber: string;
  returnableQuantity: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [mode, setMode] = useState<"FULL" | "PARTIAL">("FULL");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const action = createSupplierReturnFromStockAction.bind(null, inventoryPositionId);
  const [state, formAction, pending] = useActionState<StockSupplierReturnActionState, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (!state?.success) return;
    toast.success(state.success);
    setCompleted(true);
    setOpen(false);
    if (state.redirectTo) router.push(state.redirectTo);
  }, [router, state]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && !open) {
          setCompleted(false);
          setIdempotencyKey(crypto.randomUUID());
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" disabled={returnableQuantity < 1}>
          Lieferantenretoure anlegen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lieferantenretoure anlegen</DialogTitle>
          <DialogDescription>
            Die Retoure wird zunächst geplant. Erst „Versenden &amp; Bestand buchen“ reduziert den verfügbaren Bestand.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2">
          <Info label="Produkt" value={productName} />
          <Info label="Lagernummer" value={inventoryNumber} mono />
          <Info label="Lieferant" value={supplier || "–"} />
          <Info label="Einkauf" value={purchaseNumber} mono />
          <Info label="Maximal retournierbar" value={`${returnableQuantity} Stück`} />
          <Info label="Quellbestand" value="Verfügbar" />
        </dl>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Retourenmenge</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                value="FULL"
                checked={mode === "FULL"}
                onChange={() => setMode("FULL")}
              />
              Gesamte zulässige Menge ({returnableQuantity} Stück)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                value="PARTIAL"
                checked={mode === "PARTIAL"}
                onChange={() => setMode("PARTIAL")}
              />
              Teilmenge
            </label>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor={`${inventoryPositionId}-return-quantity`}>Menge (Stück)</Label>
            <Input
              id={`${inventoryPositionId}-return-quantity`}
              name="quantity"
              type="number"
              min={1}
              max={returnableQuantity}
              defaultValue={returnableQuantity}
              disabled={mode === "FULL"}
              required
            />
            {mode === "FULL" && (
              <input type="hidden" name="quantity" value={returnableQuantity} />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${inventoryPositionId}-return-reason`}>Rückgabegrund</Label>
            <Input
              id={`${inventoryPositionId}-return-reason`}
              name="reason"
              maxLength={500}
              required
              placeholder="z. B. falsche Ausführung oder Lieferantenvereinbarung"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending || completed || returnableQuantity < 1 || !idempotencyKey}>
            {pending ? "Wird geplant…" : "Lieferantenretoure planen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className={mono ? "font-mono" : undefined}>{value}</dd></div>;
}
