"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createStockItemAction } from "@/lib/actions/stock";
import type { ActionState } from "@/lib/actions/team";
import { STOCK_STATUS_LABELS } from "@/lib/constants";
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

export function CreateStockItemDialog({
  platforms,
}: {
  platforms: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [deductible, setDeductible] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createStockItemAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Wareneingang erfassen</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Wareneingang erfassen</DialogTitle>
          <DialogDescription>
            Neuen Artikel in den Lagerbestand aufnehmen. Netto wird bei
            Vorsteuerabzug automatisch berechnet.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="si-title">Bezeichnung *</Label>
              <Input id="si-title" name="title" required placeholder="Nike Air Jordan 1 Mid" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-model">Modell</Label>
              <Input id="si-model" name="model" placeholder="Air Jordan 1 Mid" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-variant">Variante</Label>
              <Input id="si-variant" name="variant" placeholder="Chicago / DN3707-100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-size">Größe</Label>
              <Input id="si-size" name="size" placeholder="EU 43" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-ean">EAN</Label>
              <Input id="si-ean" name="ean" inputMode="numeric" placeholder="4066748241234" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-supplier">Händler</Label>
              <Input id="si-supplier" name="supplier" placeholder="Foot Locker / privat" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-date">Einkaufsdatum</Label>
              <Input id="si-date" name="purchaseDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-price">Preis brutto (€) *</Label>
              <Input id="si-price" name="priceGross" required inputMode="decimal" placeholder="89,99" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-payment">Zahlungsmethode</Label>
              <Input id="si-payment" name="paymentMethod" placeholder="PayPal / Bar / Überweisung" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="inputTaxDeductible"
                checked={deductible}
                onChange={(e) => setDeductible(e.target.checked)}
                className="size-4"
              />
              Vorsteuerabzugsfähig (Netto wird automatisch berechnet)
            </label>
            {deductible && (
              <label className="flex items-center gap-2 text-sm">
                USt-Satz:
                <select
                  name="inputTaxRatePercent"
                  defaultValue="19"
                  className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="19">19 %</option>
                  <option value="7">7 %</option>
                </select>
              </label>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="si-qty">Menge</Label>
              <Input id="si-qty" name="quantity" type="number" min={1} defaultValue={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-status">Status</Label>
              <select
                id="si-status"
                name="status"
                defaultValue="IN_STOCK"
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                {Object.entries(STOCK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-consignment">Konsignations-Ref. (optional)</Label>
              <Input id="si-consignment" name="consignmentRefId" placeholder="K-2026-001" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gelistet auf</Label>
            <div className="flex flex-wrap gap-3 rounded-md border p-3">
              {platforms.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Keine aktiven Plattformen vorhanden.
                </span>
              )}
              {platforms.map((platform) => (
                <label key={platform.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="platformIds"
                    value={platform.id}
                    className="size-4"
                  />
                  {platform.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="si-image">Bild (JPG/PNG/WebP, max. 5 MB)</Label>
              <Input id="si-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-notes">Notizen</Label>
              <Input id="si-notes" name="notes" placeholder="optional" />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Wird gespeichert…" : "Artikel erfassen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
