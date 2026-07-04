"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteDebtAction, toggleDebtSettledAction } from "@/lib/actions/debts";
import { Button } from "@/components/ui/button";

export function DebtRowActions({
  debtId,
  settled,
  canDelete,
}: {
  debtId: string;
  settled: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await toggleDebtSettledAction(debtId, !settled);
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  function remove() {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    startTransition(async () => {
      const result = await deleteDebtAction(debtId);
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" disabled={pending} onClick={toggle}>
        {settled ? "Wieder öffnen" : "Als beglichen markieren"}
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={pending}
          onClick={remove}
        >
          Löschen
        </Button>
      )}
    </div>
  );
}
