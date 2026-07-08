"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { applyReturnWorkflowAction } from "@/lib/actions/returns";
import type { ReturnWorkflowOperation } from "@/lib/services/returns-service";
import { Button } from "@/components/ui/button";

export function ReturnWorkflowActions({
  returnId,
  disabled,
}: {
  returnId: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <WorkflowButton returnId={returnId} operation="RECEIVE" label="Eingang" disabled={disabled} />
      <WorkflowButton returnId={returnId} operation="RESTOCK" label="Verfügbar" disabled={disabled} />
      <WorkflowButton returnId={returnId} operation="DEFECTIVE" label="Defekt" disabled={disabled} />
    </div>
  );
}

function WorkflowButton({
  returnId,
  operation,
  label,
  disabled,
}: {
  returnId: string;
  operation: ReturnWorkflowOperation;
  label: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending || disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await applyReturnWorkflowAction(returnId, operation);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.success);
        })
      }
    >
      {pending ? "Bucht…" : label}
    </Button>
  );
}
