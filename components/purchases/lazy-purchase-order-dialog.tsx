"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loadPurchaseProductOptionsAction } from "@/lib/actions/purchases";
import { PurchaseOrderDialog } from "@/components/purchases/purchase-dialogs";
import { Button } from "@/components/ui/button";

type Option = { id: string; label: string };

export function LazyPurchaseOrderDialog({
  suppliers,
  paymentMethods,
}: {
  suppliers: Option[];
  paymentMethods: string[];
}) {
  const [products, setProducts] = useState<
    Awaited<ReturnType<typeof loadPurchaseProductOptionsAction>>["products"]
  >(undefined);
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await loadPurchaseProductOptionsAction();
      if (result.error || !result.products) {
        toast.error(result.error ?? "Produkte konnten nicht geladen werden.");
        return;
      }
      setProducts(result.products);
    });
  }

  if (products) {
    return (
      <PurchaseOrderDialog
        suppliers={suppliers}
        paymentMethods={paymentMethods}
        products={products.map((item) => ({
          id: item.id,
          name: item.name,
          imageUrl: item.imageUrls[0] ?? "",
          label: [item.name, item.variant].filter(Boolean).join(" · "),
        }))}
        initialOpen
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setProducts(undefined);
        }}
      />
    );
  }

  return (
    <Button onClick={open} disabled={pending} aria-busy={pending}>
      {pending ? "Formular wird geladen…" : "Einkauf anlegen"}
    </Button>
  );
}
