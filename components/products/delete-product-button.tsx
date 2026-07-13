"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteProductAction } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/table/confirm-action-dialog";

export function DeleteProductButton({
  productId,
  name,
}: {
  productId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <ConfirmActionDialog
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={pending}
        >
          {pending ? "Löscht…" : "Löschen"}
        </Button>
      }
      title="Produkt löschen?"
      description={`„${name}“ wird nur gelöscht, wenn keine Einkaufs-, Lager- oder Verkaufsposition darauf verweist.`}
      confirmLabel="Unreferenziertes Produkt löschen"
      disabled={pending}
      onConfirm={() => {
        startTransition(async () => {
          const result = await deleteProductAction(productId);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        });
      }}
    />
  );
}
