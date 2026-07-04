"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createShippingRateAction } from "@/lib/actions/shipping";
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

export function CreateShippingRateDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createShippingRateAction,
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
        <Button>Tarif anlegen</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Versandtarif anlegen</DialogTitle>
          <DialogDescription>
            Preis = Grundpreis + Gewicht × Kilopreis. Zuschläge werden im
            Kalkulator separat ausgewiesen.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rate-carrier">Dienstleister *</Label>
              <Input
                id="rate-carrier"
                name="carrierName"
                required
                placeholder="DHL / DPD / Hermes / GLS / UPS"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-name">Tarifname *</Label>
              <Input id="rate-name" name="name" required placeholder="Paket M national" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-zone">Zone *</Label>
              <Input id="rate-zone" name="zone" required placeholder="DE / EU / Welt" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-countries">Länder (ISO-2, leer = alle)</Label>
              <Input id="rate-countries" name="countries" placeholder="DE, AT, CH" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-base">Grundpreis (€) *</Label>
              <Input id="rate-base" name="basePrice" required inputMode="decimal" placeholder="5,49" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-perkg">Kilopreis (€/kg)</Label>
              <Input id="rate-perkg" name="perKgPrice" inputMode="decimal" placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-maxkg">max. Gewicht (kg)</Label>
              <Input id="rate-maxkg" name="maxWeightKg" type="number" step="0.1" min="0" placeholder="31,5" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate-surcharges">Zuschläge (JSON, optional)</Label>
            <textarea
              id="rate-surcharges"
              name="surchargesJson"
              rows={3}
              placeholder='[{"label":"Sperrgut","cents":500}]'
              className="border-input w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs"
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Wird gespeichert…" : "Tarif anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
