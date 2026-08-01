"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { toast } from "sonner";
import { loadSellableSaleItemsAction } from "@/lib/actions/sales";
import { SaleDialog } from "@/components/sales/sale-dialog";
import { Button } from "@/components/ui/button";

type SaleDialogOptions = Omit<
  ComponentProps<typeof SaleDialog>,
  "items" | "sale" | "trigger" | "initialOpen" | "onOpenChange"
>;

export function LazyCreateSaleDialog(props: SaleDialogOptions) {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof loadSellableSaleItemsAction>>["items"]
  >(undefined);
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await loadSellableSaleItemsAction();
      if (result.error || !result.items) {
        toast.error(
          result.error ?? "Verfügbare Lagerpositionen konnten nicht geladen werden."
        );
        return;
      }
      setItems(result.items);
    });
  }

  if (items) {
    return (
      <SaleDialog
        {...props}
        items={items}
        initialOpen
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setItems(undefined);
        }}
      />
    );
  }

  return (
    <Button onClick={open} disabled={pending} aria-busy={pending}>
      {pending ? "Formular wird geladen…" : "Verkauf erfassen"}
    </Button>
  );
}
