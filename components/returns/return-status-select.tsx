"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ReturnStatus } from "@prisma/client";
import { updateReturnStatusAction } from "@/lib/actions/returns";
import { RETURN_STATUS_LABELS } from "@/lib/constants";

export function ReturnStatusSelect({
  returnId,
  currentStatus,
}: {
  returnId: string;
  currentStatus: ReturnStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={currentStatus}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const result = await updateReturnStatusAction(
            returnId,
            e.target.value as ReturnStatus
          );
          if (result?.error) toast.error(result.error);
        })
      }
      className="border-input h-8 rounded-md border bg-transparent px-2 text-xs"
    >
      {Object.entries(RETURN_STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
