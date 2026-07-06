"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateReturnAction } from "@/lib/actions/returns";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface EditableReturn {
  id: string;
  saleLabel: string;
  requestedAt: string; // yyyy-mm-dd
  reason: string;
  refundAmount: string;
  extraCost: string;
  notes: string;
}

export function EditReturnDialog({ ret }: { ret: EditableReturn }) {
  const [open, setOpen] = useState(false);
  const action = updateReturnAction.bind(null, ret.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Bearbeiten
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retoure bearbeiten</DialogTitle>
          <DialogDescription>
            {ret.saleLabel} – der Verlust wird nach dem Speichern neu berechnet.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ret-edit-date">Meldedatum</Label>
              <Input id="ret-edit-date" name="requestedAt" type="date" defaultValue={ret.requestedAt} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ret-edit-reason">Grund</Label>
              <Input id="ret-edit-reason" name="reason" defaultValue={ret.reason} placeholder="z.B. defekt geliefert" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ret-edit-refund">Erstattungsbetrag (€)</Label>
              <Input id="ret-edit-refund" name="refundAmount" inputMode="decimal" defaultValue={ret.refundAmount} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ret-edit-extra">Zusatzkosten (€)</Label>
              <Input id="ret-edit-extra" name="extraCost" inputMode="decimal" defaultValue={ret.extraCost} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ret-edit-notes">Notizen</Label>
            <Input id="ret-edit-notes" name="notes" defaultValue={ret.notes} placeholder="optional" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert…" : "Änderungen speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
