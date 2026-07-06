"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateLowStockThresholdAction } from "@/lib/actions/organization";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LowStockCard({
  threshold,
  readOnly,
}: {
  threshold: number;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateLowStockThresholdAction,
    null
  );

  useEffect(() => {
    if (state?.success) toast.success(state.success);
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-sm items-end gap-2">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex-1 space-y-1">
        <Label htmlFor="low-stock">Warnschwelle (Restmenge)</Label>
        <Input
          id="low-stock"
          name="lowStockThreshold"
          type="number"
          min={0}
          max={1000}
          defaultValue={threshold}
          disabled={readOnly}
        />
      </div>
      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? "Speichert…" : "Speichern"}
        </Button>
      )}
    </form>
  );
}
