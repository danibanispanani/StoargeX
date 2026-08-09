"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { loadSaleDialogOptionsAction } from "@/lib/actions/sales";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { SaleDialog } from "@/components/sales/sale-dialog";

type LazySaleDialogProps = Omit<
  ComponentProps<typeof SaleDialog>,
  | "initialOpen"
  | "items"
  | "trigger"
  | "platforms"
  | "marketplaceAccounts"
  | "payoutOptions"
  | "shippingRates"
>;
type SaleDialogOptions = Awaited<ReturnType<typeof loadSaleDialogOptionsAction>>;

export function LazySaleDialog(props: LazySaleDialogProps) {
  const [options, setOptions] = useState<SaleDialogOptions | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await loadSaleDialogOptionsAction();
      if (
        result.error ||
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
    !options?.platforms ||
    !options.marketplaceAccounts ||
    !options.payoutOptions ||
    !options.shippingRates
  ) {
    return (
      <ActionIconButton
        label={pending ? "Formular wird geladen" : "Verkauf bearbeiten"}
        icon={PencilIcon}
        onClick={open}
        disabled={pending}
      />
    );
  }

  return (
    <SaleDialog
      {...props}
      initialOpen
      items={[]}
      platforms={options.platforms}
      marketplaceAccounts={options.marketplaceAccounts}
      payoutOptions={options.payoutOptions}
      shippingRates={options.shippingRates}
      trigger={<ActionIconButton label="Verkauf bearbeiten" icon={PencilIcon} />}
    />
  );
}
