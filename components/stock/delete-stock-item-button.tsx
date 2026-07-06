"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteStockItemAction } from "@/lib/actions/stock";
import { Button } from "@/components/ui/button";

export function DeleteStockItemButton({
  stockItemId,
  sku,
}: {
  stockItemId: string;
  sku: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-customs-red hover:text-customs-red"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Artikel ${sku} wirklich loeschen?`)) return;
        startTransition(async () => {
          const result = await deleteStockItemAction(stockItemId);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        });
      }}
    >
      Loeschen
    </Button>
  );
}
