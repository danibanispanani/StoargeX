"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { DebtEntry, DebtStatus } from "@prisma/client";
import {
  deleteDebtAction,
  updateDebtEntryAction,
  updateDebtStatusAction,
} from "@/lib/actions/debts";
import { DEBT_ENTRY, DEBT_STATUS, DEBT_STATUS_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DebtStatusSelect({
  debtId,
  status,
}: {
  debtId: string;
  status: DebtStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status === "PARTIALLY_PAID" ? "OPEN" : status}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const result = await updateDebtStatusAction(
            debtId,
            e.target.value as DebtStatus
          );
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        })
      }
      className={cn(
        "h-7 rounded-md border-0 px-1.5 text-xs font-medium",
        DEBT_STATUS[status].className
      )}
    >
      {DEBT_STATUS_OPTIONS.map((value) => (
        <option key={value} value={value}>
          {DEBT_STATUS[value].label}
        </option>
      ))}
    </select>
  );
}

export function DebtEntrySelect({
  debtId,
  entryStatus,
}: {
  debtId: string;
  entryStatus: DebtEntry;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={entryStatus}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const result = await updateDebtEntryAction(
            debtId,
            e.target.value as DebtEntry
          );
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        })
      }
      className={cn(
        "h-7 rounded-md border-0 px-1.5 text-xs font-medium",
        DEBT_ENTRY[entryStatus].className
      )}
    >
      <option value="IO">I.O</option>
      <option value="FEHLT">Fehlt</option>
    </select>
  );
}

export function DeleteDebtButton({ debtId }: { debtId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("Diesen Schulden-Eintrag wirklich löschen?")) return;
        startTransition(async () => {
          const result = await deleteDebtAction(debtId);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        });
      }}
    >
      Löschen
    </Button>
  );
}
