"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  linkConsignmentSalesAction,
  updateConsignmentCountsAction,
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
  quantity: number;
  soldQuantity: number;
  returnedQuantity: number;
  defectiveQuantity: number;
  linkedSaleIds: string[];
}

export function ConsignmentRowActions({
  item,
  saleOptions,
}: {
  item: ConsignmentRow;
  saleOptions: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="flex gap-1">
      <CountsDialog item={item} />
      <LinkSalesDialog item={item} saleOptions={saleOptions} />
    </div>
  );
}

function CountsDialog({ item }: { item: ConsignmentRow }) {
  const [open, setOpen] = useState(false);
  const boundAction = updateConsignmentCountsAction.bind(null, item.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    boundAction,
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
        <Button variant="ghost" size="sm">
          Bestände
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bestände – {item.sku}</DialogTitle>
          <DialogDescription>
            Aktuelle Zähler für Bestand, verkauft, retourniert und defekt.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`qty-${item.id}`}>Bestand</Label>
              <Input id={`qty-${item.id}`} name="quantity" type="number" min={0} defaultValue={item.quantity} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`sold-${item.id}`}>Verkauft</Label>
              <Input id={`sold-${item.id}`} name="soldQuantity" type="number" min={0} defaultValue={item.soldQuantity} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ret-${item.id}`}>Retourniert</Label>
              <Input id={`ret-${item.id}`} name="returnedQuantity" type="number" min={0} defaultValue={item.returnedQuantity} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`def-${item.id}`}>Defekt</Label>
              <Input id={`def-${item.id}`} name="defectiveQuantity" type="number" min={0} defaultValue={item.defectiveQuantity} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert…" : "Speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkSalesDialog({
  item,
  saleOptions,
}: {
  item: ConsignmentRow;
  saleOptions: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(item.linkedSaleIds));
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await linkConsignmentSalesAction(item.id, [...selected]);
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
        <Button variant="ghost" size="sm">
          Verkäufe ({item.linkedSaleIds.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verkäufe verknüpfen – {item.sku}</DialogTitle>
          <DialogDescription>
            Verknüpfte Sale-Einträge fließen in die separate Umsatz-/Margen-
            Auswertung dieses Konsignationsartikels ein.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {saleOptions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Noch keine Verkäufe vorhanden.
            </p>
          )}
          {saleOptions.map((sale) => (
            <label key={sale.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(sale.id)}
                onChange={() => toggle(sale.id)}
                className="mt-0.5 size-4"
              />
              {sale.label}
            </label>
          ))}
        </div>
        <Button onClick={save} disabled={pending} className="w-full">
          {pending ? "Speichert…" : "Verknüpfung speichern"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
