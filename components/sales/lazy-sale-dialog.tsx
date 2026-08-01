"use client";

import { useState, type ComponentProps } from "react";
import { PencilIcon } from "lucide-react";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { SaleDialog } from "@/components/sales/sale-dialog";

type LazySaleDialogProps = Omit<
  ComponentProps<typeof SaleDialog>,
  "initialOpen" | "items" | "trigger"
>;

export function LazySaleDialog(props: LazySaleDialogProps) {
  const [mounted, setMounted] = useState(false);

  if (!mounted) {
    return (
      <ActionIconButton label="Verkauf bearbeiten" icon={PencilIcon} onClick={() => setMounted(true)} />
    );
  }

  return (
    <SaleDialog
      {...props}
      initialOpen
      items={[]}
      trigger={
        <ActionIconButton label="Verkauf bearbeiten" icon={PencilIcon} />
      }
    />
  );
}
