"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cancelSaleAction } from "@/lib/actions/sales";
import { Button } from "@/components/ui/button";

export function CancelSaleButton({ saleId }: { saleId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Verkauf stornieren und Bestand zurückführen?")) return;
        startTransition(async () => {
          const result = await cancelSaleAction(saleId);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        });
      }}
    >
      {pending ? "Storniert…" : "Storno"}
    </Button>
  );
}
