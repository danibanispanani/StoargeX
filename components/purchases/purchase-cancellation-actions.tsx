"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  cancelPurchaseAction,
  cancelPurchaseReceiptAction,
  type PurchaseActionState,
} from "@/lib/actions/purchases";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/table/confirm-action-dialog";

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

export function CancelPurchaseReceiptButton({ receiptId }: { receiptId: string }) {
  const { pending, run } = usePurchaseAction();
  return <ConfirmActionDialog
    trigger={<Button size="sm" variant="destructive" disabled={pending}>{pending ? "Storniert…" : "Eingang stornieren"}</Button>}
    title="Wareneingang stornieren?"
    description="Die gebuchte Menge wird aus dem Lager entfernt und in der Bestellung wieder geöffnet."
    confirmLabel="Eingang stornieren"
    onConfirm={() => run(() => cancelPurchaseReceiptAction(receiptId))}
    disabled={pending}
  />;
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
