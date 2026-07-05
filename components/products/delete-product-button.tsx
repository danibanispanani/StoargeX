"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteProductAction } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";

export function DeleteProductButton({
  productId,
  name,
}: {
  productId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Produkt "${name}" wirklich löschen?`)) return;
        startTransition(async () => {
          const result = await deleteProductAction(productId);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        });
      }}
    >
      Löschen
    </Button>
  );
}
