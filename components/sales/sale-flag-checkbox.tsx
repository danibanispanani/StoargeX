"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleSaleFlagAction, type SaleFlagField } from "@/lib/actions/sales";

/** Informativer Status: Rechnung erstellt / Porto gebucht / Gebühren gebucht. */
export function SaleFlagCheckbox({
  saleId,
  field,
  checked,
  title,
}: {
  saleId: string;
  field: SaleFlagField;
  checked: boolean;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      title={title}
      checked={checked}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const result = await toggleSaleFlagAction(saleId, field, e.target.checked);
          if (result?.error) toast.error(result.error);
        })
      }
      className="size-4 cursor-pointer"
    />
  );
}
