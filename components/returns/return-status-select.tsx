"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ReturnStatus } from "@prisma/client";
import { updateReturnStatusAction } from "@/lib/actions/returns";
import { RETURN_STATUS, RETURN_STATUS_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

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
          else if (result?.success) toast.success(result.success);
        })
      }
      className={cn(
        "h-7 rounded-md border-0 px-1.5 text-xs font-medium",
        RETURN_STATUS[currentStatus].className
      )}
    >
      {RETURN_STATUS_OPTIONS.map((value) => (
        <option key={value} value={value}>
          {RETURN_STATUS[value].label}
        </option>
      ))}
    </select>
  );
}
