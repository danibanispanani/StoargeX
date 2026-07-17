"use client";

import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { SaleDialog } from "@/components/sales/sale-dialog";

type LazySaleDialogProps = Omit<
  ComponentProps<typeof SaleDialog>,
  "initialOpen" | "items" | "trigger"
>;

export function LazySaleDialog(props: LazySaleDialogProps) {
  const [mounted, setMounted] = useState(false);

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setMounted(true)}>
        Bearbeiten
      </Button>
    );
  }

  return (
    <SaleDialog
      {...props}
      initialOpen
      items={[]}
      trigger={
        <Button variant="ghost" size="sm">
          Bearbeiten
        </Button>
      }
    />
  );
}
