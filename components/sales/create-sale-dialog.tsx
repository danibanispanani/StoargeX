"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createSaleAction } from "@/lib/actions/sales";
import type { ActionState } from "@/lib/actions/team";
import { COUNTRIES } from "@/lib/constants";
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

export function CreateSaleDialog({
  platforms,
  stockItems,
}: {
  platforms: Array<{ id: string; name: string }>;
  stockItems: Array<{ id: string; sku: string; title: string; size: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createSaleAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    }
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Verkauf erfassen</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Verkauf erfassen</DialogTitle>
          <DialogDescription>
            VK netto, Marge und Gewinn werden server-seitig berechnet
            (USt-Satz je Käuferland aus den Einstellungen). Der Lagerbestand
            reduziert sich automatisch.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="sale-item">Artikel *</Label>
            <select
              id="sale-item"
              name="stockItemId"
              required
              defaultValue=""
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="" disabled>
                Artikel wählen…
              </option>
              {stockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} – {item.title}
                  {item.size ? ` (${item.size})` : ""}
                </option>
              ))}
            </select>
            {stockItems.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Kein verkaufsfähiger Lagerbestand. Erst unter „Lager&ldquo; einen
                Wareneingang erfassen.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sale-date">Verkaufsdatum</Label>
              <Input id="sale-date" name="soldAt" type="date" defaultValue={today} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-gross">VK brutto (€) *</Label>
              <Input id="sale-gross" name="saleGross" required inputMode="decimal" placeholder="129,99" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-country">Käuferland *</Label>
              <Input
                id="sale-country"
                name="buyerCountry"
                required
                defaultValue="DE"
                maxLength={2}
                list="sale-countries"
                className="uppercase"
              />
              <datalist id="sale-countries">
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-platform">Plattform *</Label>
              <select
                id="sale-platform"
                name="platformId"
                required
                defaultValue=""
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="" disabled>
                  Plattform wählen…
                </option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-shipping-method">Versandart</Label>
              <Input
                id="sale-shipping-method"
                name="shippingMethod"
                placeholder="DHL Paket M (Vorschlag: /versand)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-shipping-cost">Versandkosten (€)</Label>
              <Input id="sale-shipping-cost" name="shippingCost" inputMode="decimal" placeholder="5,49" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-platform-fee">Plattformgebühr (€)</Label>
              <Input id="sale-platform-fee" name="platformFee" inputMode="decimal" placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-payment-fee">Zahlungsgebühr (€)</Label>
              <Input id="sale-payment-fee" name="paymentFee" inputMode="decimal" placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-payout">Auszahlungsempfänger</Label>
              <Input id="sale-payout" name="payoutRecipient" placeholder="Gemeinsames Konto / Max" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-buyer">Käufer (Username)</Label>
              <Input id="sale-buyer" name="buyerUsername" placeholder="optional" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale-notes">Notizen</Label>
            <Input id="sale-notes" name="notes" placeholder="optional" />
          </div>

          <Button type="submit" className="w-full" disabled={pending || stockItems.length === 0}>
            {pending ? "Wird gespeichert…" : "Verkauf erfassen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
