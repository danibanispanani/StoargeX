"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loadStockReceiptProductOptionsAction } from "@/lib/actions/stock";
import { Button } from "@/components/ui/button";
import { StockItemDialog } from "@/components/stock/stock-item-dialog";

export function LazyStockItemDialog({
  platforms,
  zmOptions,
  storageLocations,
}: {
  platforms: Array<{ id: string; name: string }>;
  zmOptions: string[];
  storageLocations: string[];
}) {
  const [products, setProducts] = useState<
    Awaited<ReturnType<typeof loadStockReceiptProductOptionsAction>>["products"]
  >(undefined);
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await loadStockReceiptProductOptionsAction();
      if (result.error || !result.products) {
        toast.error(result.error ?? "Produkte konnten nicht geladen werden.");
        return;
      }
      setProducts(result.products);
    });
  }

  if (products) {
    return (
      <StockItemDialog
        platforms={platforms}
        zmOptions={zmOptions}
        storageLocations={storageLocations}
        products={products}
        initialOpen
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setProducts(undefined);
        }}
      />
    );
  }

  return (
    <Button onClick={open} disabled={pending} aria-busy={pending}>
      {pending ? "Formular wird geladen…" : "Wareneingang erfassen"}
    </Button>
  );
}
