"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loadSaleDialogOptionsAction } from "@/lib/actions/sales";
import { SaleDialog } from "@/components/sales/sale-dialog";
import { Button } from "@/components/ui/button";

type SaleDialogOptions = Awaited<ReturnType<typeof loadSaleDialogOptionsAction>>;

export function LazyCreateSaleDialog() {
  const [options, setOptions] = useState<SaleDialogOptions | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await loadSaleDialogOptionsAction({ includeItems: true });
      if (
        result.error ||
        !result.items ||
        !result.platforms ||
        !result.marketplaceAccounts ||
        !result.payoutOptions ||
        !result.shippingRates
      ) {
        toast.error(result.error ?? "Verkaufsformular konnte nicht geladen werden.");
        return;
      }
      setOptions(result);
    });
  }

  if (
    options?.items &&
    options.platforms &&
    options.marketplaceAccounts &&
    options.payoutOptions &&
    options.shippingRates
  ) {
    return (
      <SaleDialog
        items={options.items}
        platforms={options.platforms}
        marketplaceAccounts={options.marketplaceAccounts}
        payoutOptions={options.payoutOptions}
        shippingRates={options.shippingRates}
        initialOpen
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setOptions(undefined);
        }}
      />
    );
  }

  return (
    <Button onClick={open} disabled={pending} aria-busy={pending}>
      {pending ? "Formular wird geladen..." : "Verkauf erfassen"}
    </Button>
  );
}
