"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelPurchaseAction,
  cancelPurchaseReceiptAction,
  cancelPurchaseReceiptLineQuantityAction,
  type PurchaseActionState,
} from "@/lib/actions/purchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionDialog } from "@/components/table/confirm-action-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function usePurchaseAction() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<PurchaseActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
    });
  }
  return { pending, run };
}

export function CancelPurchaseReceiptButton({
  receiptId,
  label = "Eingang stornieren",
  description = "Die gebuchte Menge wird aus dem Lager entfernt und in der Bestellung wieder geöffnet.",
}: {
  receiptId: string;
  label?: string;
  description?: string;
}) {
  const { pending, run } = usePurchaseAction();
  return <ConfirmActionDialog
    trigger={<Button size="sm" variant="destructive" disabled={pending}>{pending ? "Storniert…" : label}</Button>}
    title="Wareneingang stornieren?"
    description={description}
    confirmLabel="Eingang stornieren"
    onConfirm={() => run(() => cancelPurchaseReceiptAction(receiptId))}
    disabled={pending}
  />;
}

export function CancelStockQuantityButton({
  inventoryPositionId,
  inventoryNumber,
  maxQuantity,
}: {
  inventoryPositionId: string;
  inventoryNumber: string;
  maxQuantity: number;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(maxQuantity);
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useRef("");
  const valid = Number.isInteger(quantity) && quantity > 0 && quantity <= maxQuantity;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) {
          setQuantity(maxQuantity);
          idempotencyKey.current = "";
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="destructive" disabled={maxQuantity <= 0}>
          Stornieren
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{inventoryNumber} stornieren</DialogTitle>
          <DialogDescription>
            Wähle, wie viele der maximal {maxQuantity} verfügbaren Stück zurückgebucht
            werden sollen. Ein Vollstorno entfernt die Position aus dem aktiven Bestand,
            bewahrt aber die Buchungs- und Audit-Historie.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`${inventoryPositionId}-cancel-quantity`}>Stornomenge</Label>
          <Input
            id={`${inventoryPositionId}-cancel-quantity`}
            type="number"
            min={1}
            max={maxQuantity}
            step={1}
            value={quantity}
            disabled={pending}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setQuantity(maxQuantity)}
          >
            Gesamte Restmenge ({maxQuantity})
          </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>Abbrechen</Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !valid}
            onClick={() => {
              const key = idempotencyKey.current || crypto.randomUUID();
              idempotencyKey.current = key;
              startTransition(async () => {
                const result = await cancelPurchaseReceiptLineQuantityAction(
                  inventoryPositionId,
                  quantity,
                  key
                );
                if (result.error) toast.error(result.error);
                if (result.success) {
                  toast.success(result.success);
                  setOpen(false);
                  idempotencyKey.current = "";
                }
              });
            }}
          >
            {pending ? "Wird storniert…" : quantity === maxQuantity
              ? "Vollständig stornieren"
              : `${quantity} Stück stornieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelPurchaseButton({ purchaseId }: { purchaseId: string }) {
  const { pending, run } = usePurchaseAction();
  return <ConfirmActionDialog
    trigger={<Button size="sm" variant="destructive" disabled={pending}>{pending ? "Storniert…" : "Bestellung stornieren"}</Button>}
    title="Gesamte Bestellung stornieren?"
    description="Noch vorhandene Wareneingänge werden ebenfalls aus dem Lager zurückgebucht."
    confirmLabel="Bestellung stornieren"
    onConfirm={() => run(() => cancelPurchaseAction(purchaseId))}
    disabled={pending}
  />;
}
