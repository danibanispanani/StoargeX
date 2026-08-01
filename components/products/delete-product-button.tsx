"use client";

import { useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteProductAction } from "@/lib/actions/products";
import { ActionIconButton } from "@/components/ui/action-icon-button";
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
        <ActionIconButton
          label={pending ? "Produkt wird gelöscht" : "Produkt löschen"}
          icon={Trash2Icon}
          className="text-destructive"
          disabled={pending}
        />
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
