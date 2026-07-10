"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  adjustConsignmentStockAction,
  deleteConsignmentItemAction,
  updateConsignmentItemAction,
} from "@/lib/actions/consignment";
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

interface ConsignmentRow {
  id: string;
  sku: string;
  source: "inventory" | "legacy";
  inventoryPositionId?: string;
  partner: string;
  title: string;
  brand?: string | null;
  modelCode?: string | null;
  extraInfo?: string | null;
  category?: string | null;
  ean?: string | null;
  identificationNumber?: string | null;
  costGrossCents?: number | null;
  costNetCents?: number | null;
  quantity: number;
  soldQuantity: number;
  returnedQuantity: number;
  defectiveQuantity: number;
  linkedSaleIds: string[];
}

export function ConsignmentRowActions({ item }: { item: ConsignmentRow }) {
  return (
    <div className="flex justify-end gap-1">
      <EditDialog item={item} />
      <DeleteDialog item={item} />
    </div>
  );
}

function EditDialog({ item }: { item: ConsignmentRow }) {
  const [open, setOpen] = useState(false);
  const boundAction = updateConsignmentItemAction.bind(null, item.inventoryPositionId ?? item.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, null);
  const boundAdjustmentAction = item.inventoryPositionId
    ? adjustConsignmentStockAction.bind(null, item.inventoryPositionId)
    : async () => ({ error: "Bestandskorrektur ist nur fuer Inventory-Positionen verfuegbar." });
  const [adjustmentState, adjustmentFormAction, adjustmentPending] = useActionState<ActionState, FormData>(
    boundAdjustmentAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    }
  }, [state]);

  useEffect(() => {
    if (adjustmentState?.success) {
      toast.success(adjustmentState.success);
      setOpen(false);
    }
  }, [adjustmentState]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Bearbeiten</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Konsignationsartikel bearbeiten - {item.sku}</DialogTitle>
          <DialogDescription>
            Stammdaten korrigieren. Verkauf, Retoure und Defekt laufen ueber Verkauf
            und Retouren.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id={`partner-${item.id}`} name="partner" label="Partner" value={item.partner} />
            <TextField id={`title-${item.id}`} name="title" label="Artikel" value={item.title} />
            <TextField id={`brand-${item.id}`} name="brand" label="Marke" value={item.brand ?? ""} />
            <TextField id={`sku-${item.id}`} name="sku" label="Bezeichnung/SKU" value={item.modelCode ?? item.sku} />
            <TextField id={`variant-${item.id}`} name="variant" label="Zusatzinfo/Variante" value="" />
            <TextField id={`ean-${item.id}`} name="ean" label="EAN" value={item.ean ?? ""} />
            <TextField id={`ident-${item.id}`} name="identificationNumber" label="Identifikation" value={item.identificationNumber ?? ""} />
            <TextField id={`category-${item.id}`} name="category" label="Kategorie" value={item.category ?? ""} />
            <TextField id={`gross-${item.id}`} name="costGross" label="EK brutto" value={formatCentsInput(item.costGrossCents)} />
            <TextField id={`net-${item.id}`} name="costNet" label="EK netto" value={formatCentsInput(item.costNetCents)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`comment-${item.id}`}>Details / Kommentar</Label>
            <Input id={`comment-${item.id}`} name="comment" defaultValue={item.extraInfo ?? ""} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert..." : "Speichern"}
          </Button>
        </form>

        {item.source === "inventory" && (
          <form action={adjustmentFormAction} className="space-y-4 border-t pt-4">
            {adjustmentState?.error && (
              <Alert variant="destructive">
                <AlertDescription>{adjustmentState.error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                id={`adjust-qty-${item.id}`}
                name="targetQuantityAvailable"
                label="Bestand korrigieren"
                value={item.quantity}
              />
              <TextField
                id={`adjust-comment-${item.id}`}
                name="adjustmentComment"
                label="Grund"
                value=""
              />
            </div>
            <Button type="submit" variant="outline" className="w-full" disabled={adjustmentPending}>
              {adjustmentPending ? "Bucht..." : "Bestandskorrektur buchen"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ item }: { item: ConsignmentRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteConsignmentItemAction(item.inventoryPositionId ?? item.id);
      if (result?.error) toast.error(result.error);
      else if (result?.success) {
        toast.success(result.success);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive">Loeschen</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Konsignationsartikel loeschen?</DialogTitle>
          <DialogDescription>
            Loeschen ist nur moeglich, solange keine Verkaeufe, Retouren oder Schulden
            mit dieser Position verknuepft sind.
          </DialogDescription>
        </DialogHeader>
        <Button variant="destructive" onClick={remove} disabled={pending}>
          {pending ? "Loescht..." : `${item.sku} loeschen`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} defaultValue={value} />
    </div>
  );
}

function NumberField({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="number" min={0} defaultValue={value} />
    </div>
  );
}

function formatCentsInput(value: number | null | undefined) {
  return value == null ? "" : (value / 100).toFixed(2).replace(".", ",");
}
