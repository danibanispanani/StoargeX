"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteSaleAction } from "@/lib/actions/sales";
import { Button } from "@/components/ui/button";

export function DeleteSaleButton({
  saleId,
  orderNumber,
}: {
  saleId: string;
  orderNumber: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-customs-red hover:text-customs-red"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Verkauf ${orderNumber || saleId.slice(0, 8)} wirklich loeschen?`)) {
          return;
        }
        startTransition(async () => {
          const result = await deleteSaleAction(saleId);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        });
      }}
    >
      Loeschen
    </Button>
  );
}
