"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  linkConsignmentSalesAction,
  moveConsignmentInventoryAction,
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
  source: "inventory" | "legacy";
  inventoryPositionId?: string;
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
  if (item.source === "inventory" && item.inventoryPositionId) {
    return (
      <div className="flex justify-end gap-1">
        <MovementDialog item={item} operation="SELL" label="Verkauf" />
        <MovementDialog item={item} operation="RETURN_INSPECTION" label="Retoure" />
        <MovementDialog item={item} operation="DEFECTIVE" label="Defekt" />
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <CountsDialog item={item} />
      <LinkSalesDialog item={item} saleOptions={saleOptions} />
    </div>
  );
}

function MovementDialog({
  item,
  operation,
  label,
}: {
  item: ConsignmentRow;
  operation: "SELL" | "RETURN_INSPECTION" | "DEFECTIVE";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const boundAction = moveConsignmentInventoryAction.bind(
    null,
    item.inventoryPositionId ?? item.id
  );
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    boundAction,
    null
  );

  useEffect(() => {
    if (open) {
      setIdempotencyKey(
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`
      );
    }
  }, [open]);

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
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {label} buchen – {item.sku}
          </DialogTitle>
          <DialogDescription>
            Neue Konsignationsbestände werden ausschließlich über
            InventoryMovement gebucht.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <input type="hidden" name="operation" value={operation} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div className="space-y-2">
            <Label htmlFor={`move-qty-${item.id}-${operation}`}>Menge</Label>
            <Input
              id={`move-qty-${item.id}-${operation}`}
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`move-comment-${item.id}-${operation}`}>Kommentar</Label>
            <Input
              id={`move-comment-${item.id}-${operation}`}
              name="comment"
              placeholder="optional"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Bucht…" : "Buchen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
          Legacy-Bestände
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Legacy-Bestände – {item.sku}</DialogTitle>
          <DialogDescription>
            Direkte Zählerbearbeitung ist nur für alte ConsignmentInventory-Zeilen
            verfügbar.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <LegacyNumber id={`qty-${item.id}`} name="quantity" label="Bestand" value={item.quantity} />
            <LegacyNumber id={`sold-${item.id}`} name="soldQuantity" label="Verkauft" value={item.soldQuantity} />
            <LegacyNumber id={`ret-${item.id}`} name="returnedQuantity" label="Retourniert" value={item.returnedQuantity} />
            <LegacyNumber id={`def-${item.id}`} name="defectiveQuantity" label="Defekt" value={item.defectiveQuantity} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert…" : "Speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LegacyNumber({
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
          <DialogTitle>Legacy-Verkäufe verknüpfen – {item.sku}</DialogTitle>
          <DialogDescription>
            Neue Konsignationsware wird später über SaleLineAllocation verknüpft;
            dieser Dialog bleibt für Altdaten.
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
