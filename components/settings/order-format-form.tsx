"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateOrderIdFormatAction } from "@/lib/actions/tax-rates";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function OrderFormatForm({
  currentFormat,
  readOnly,
}: {
  currentFormat: string;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateOrderIdFormatAction,
    null
  );

  useEffect(() => {
    if (state?.success) toast.success(state.success);
  }, [state]);

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="order-format">Order-ID-Format</Label>
        <Input
          id="order-format"
          name="orderIdFormat"
          defaultValue={currentFormat}
          disabled={readOnly}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Tokens: <code>{"{JJJJ}"}</code> Jahr, <code>{"{JJ}"}</code> Jahr kurz,{" "}
          <code>{"{MM}"}</code> Monat, <code>{"{TT}"}</code> Tag,{" "}
          <code>{"{NR:4}"}</code> laufende Nummer (4-stellig). Beispiel:{" "}
          <code>SX-{"{JJJJ}"}-{"{NR:4}"}</code> → SX-2026-0007
        </p>
      </div>
      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? "Speichert…" : "Format speichern"}
        </Button>
      )}
    </form>
  );
}
