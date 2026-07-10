"use client";

import { useActionState, useEffect, useState } from "react";
import type { ComponentProps } from "react";
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Konsignationsartikel anlegen</DialogTitle>
          <DialogDescription>
            Neue Ware erhält eine K-Nummer und wird als InventoryPosition mit
            ConsignmentLot und Eingangsbuchung gespeichert.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-5">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Partner und Artikel</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="con-partner" name="consignorName" label="Partnerfirma *" required placeholder="z.B. Pattfield" />
              <Field id="con-contact" name="consignorContact" label="Kontakt" placeholder="mail@partner.de" />
              <Field id="con-title" name="itemTitle" label="Name *" required placeholder="z.B. Fire TV Stick" className="sm:col-span-2" />
              <Field id="con-brand" name="brand" label="Marke" placeholder="z.B. Amazon" />
              <Field id="con-variant" name="variant" label="Sonstiges / Variante" placeholder="4K · 2024" />
              <Field id="con-ean" name="ean" label="EAN" />
              <Field id="con-sku" name="sku" label="Externe SKU / Bezeichnung" placeholder="Partner-SKU optional" />
              <Field id="con-ident" name="identificationNumber" label="Identifikationsnummer" />
              <Field id="con-category" name="category" label="Kategorie" />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Bestand</h3>
            <div className="grid gap-3 sm:grid-cols-5">
              <NumberField id="con-qty-received" name="quantityReceived" label="Erhalten *" min={1} defaultValue={1} />
              <NumberField id="con-qty-available" name="quantityAvailable" label="Verfügbar" min={0} placeholder="auto" />
              <NumberField id="con-qty-sold" name="soldQuantity" label="Verkauft" min={0} defaultValue={0} />
              <NumberField id="con-qty-return" name="returnedQuantity" label="Retoure/Prüfung" min={0} defaultValue={0} />
              <NumberField id="con-qty-defect" name="defectiveQuantity" label="Defekt" min={0} defaultValue={0} />
            </div>
            <p className="text-xs text-muted-foreground">
              Wenn „Verfügbar“ leer bleibt, wird es aus erhalten minus verkauft,
              Retoure/Prüfung und defekt berechnet.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Finanzen</h3>
            <div className="grid gap-3 sm:grid-cols-5">
              <Field id="con-cost-gross" name="costGross" label="EK brutto (€)" inputMode="decimal" />
              <Field id="con-cost-net" name="costNet" label="EK netto (€)" inputMode="decimal" />
              <Field id="con-settlement" name="settlementAmount" label="Endbetrag (€)" inputMode="decimal" />
              <Field id="con-shipping" name="shippingCost" label="Versand (€)" inputMode="decimal" />
              <Field id="con-rrp" name="realRrpGross" label="Reale OVP (€)" inputMode="decimal" />
            </div>
          </section>

          <section className="space-y-3">
            <Field id="con-notes" name="notes" label="Kommentar" placeholder="optional" />
          </section>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Wird gespeichert…" : "Konsignationsbestand anlegen"}
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
}: ComponentProps<typeof Input> & {
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

function NumberField({
  id,
  name,
  label,
  min,
  defaultValue,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  min: number;
  defaultValue?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="number"
        min={min}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
}
