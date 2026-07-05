"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { SaleStatus } from "@prisma/client";
import {
  updateInvoiceStatusAction,
  updateSaleStatusAction,
} from "@/lib/actions/sales";
import { INVOICE_STATUS, SALE_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Gesamtstatus (in Bearbeitung / Abgeschlossen) – farbcodiertes Inline-Dropdown. */
export function SaleStatusSelect({
  saleId,
  status,
}: {
  saleId: string;
  status: SaleStatus;
}) {
  const [pending, startTransition] = useTransition();
  const style = SALE_STATUS[status] ?? SALE_STATUS.PENDING!;
  const editable = status === "PENDING" || status === "COMPLETED";

  if (!editable) {
    return (
      <span className={cn("rounded-md px-2 py-1 text-xs font-medium", style.className)}>
        {style.label}
      </span>
    );
  }

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const result = await updateSaleStatusAction(
            saleId,
            e.target.value as SaleStatus
          );
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        })
      }
      className={cn("h-7 rounded-md border-0 px-1.5 text-xs font-medium", style.className)}
    >
      <option value="PENDING">in Bearbeitung</option>
      <option value="COMPLETED">Abgeschlossen</option>
    </select>
  );
}

/** Rechnung (Erledigt / Offen) – farbcodiertes Inline-Dropdown. */
export function InvoiceSelect({
  saleId,
  done,
}: {
  saleId: string;
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const style = INVOICE_STATUS[done ? "done" : "open"];

  return (
    <select
      value={done ? "done" : "open"}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const result = await updateInvoiceStatusAction(
            saleId,
            e.target.value === "done"
          );
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        })
      }
      className={cn("h-7 rounded-md border-0 px-1.5 text-xs font-medium", style.className)}
    >
      <option value="open">Offen</option>
      <option value="done">Erledigt</option>
    </select>
  );
}
