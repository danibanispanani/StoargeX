"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createConsignmentItemAction } from "@/lib/actions/consignment";
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

export function CreateConsignmentDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createConsignmentItemAction,
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
        <Button>Konsignationsartikel anlegen</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Konsignationsartikel anlegen</DialogTitle>
          <DialogDescription>
            Ware einer Partnerfirma mit eigener SKU. Preisebenen als JSON,
            z.B. VK Standard / VK Aktion.
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
              <Label htmlFor="con-partner">Partnerfirma *</Label>
              <Input id="con-partner" name="consignorName" required placeholder="Sneaker Store GmbH" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="con-contact">Kontakt</Label>
              <Input id="con-contact" name="consignorContact" placeholder="mail@partner.de" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="con-title">Artikelbezeichnung *</Label>
              <Input id="con-title" name="itemTitle" required placeholder="Adidas Samba OG" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="con-sku">SKU (leer = automatisch)</Label>
              <Input id="con-sku" name="sku" placeholder="K-2026-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="con-qty">Bestand</Label>
              <Input id="con-qty" name="quantity" type="number" min={0} defaultValue={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="con-commission">Provision (%)</Label>
              <Input id="con-commission" name="commissionPercent" type="number" step="0.01" min="0" max="100" placeholder="20" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="con-payout">Fester Auszahlungsbetrag (€)</Label>
              <Input id="con-payout" name="agreedPayout" inputMode="decimal" placeholder="alternativ zur Provision" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="con-tiers">Preisebenen (JSON, optional)</Label>
            <textarea
              id="con-tiers"
              name="priceTiersJson"
              rows={3}
              placeholder='[{"label":"VK Standard","cents":4999},{"label":"VK Aktion","cents":3999}]'
              className="border-input w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="con-notes">Notizen</Label>
            <Input id="con-notes" name="notes" placeholder="optional" />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Wird gespeichert…" : "Artikel anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
