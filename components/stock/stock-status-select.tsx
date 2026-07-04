"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { StockItemStatus } from "@prisma/client";
import { updateStockItemStatusAction } from "@/lib/actions/stock";
import { STOCK_STATUS_LABELS } from "@/lib/constants";

export function StockStatusSelect({
  stockItemId,
  currentStatus,
}: {
  stockItemId: string;
  currentStatus: StockItemStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={currentStatus}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const result = await updateStockItemStatusAction(
            stockItemId,
            e.target.value as StockItemStatus
          );
          if (result?.error) toast.error(result.error);
        })
      }
      className="border-input h-8 rounded-md border bg-transparent px-2 text-xs"
    >
      {Object.entries(STOCK_STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
