"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createReturnAction } from "@/lib/actions/returns";
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

export function CreateReturnDialog({
  sales,
}: {
  sales: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createReturnAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    }
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Retoure erfassen</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Retoure erfassen</DialogTitle>
          <DialogDescription>
            Der tatsächliche Verlust wird automatisch berechnet: Erstattung
            abzüglich enthaltener USt und anteiliger Gebühren/Versand, plus
            Zusatzkosten.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="ret-sale">Verkauf *</Label>
            <select
              id="ret-sale"
              name="saleId"
              required
              defaultValue=""
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="" disabled>
                Verkauf wählen…
              </option>
              {sales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.label}
                </option>
              ))}
            </select>
            {sales.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Keine (nicht bereits erstatteten) Verkäufe vorhanden.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ret-date">Meldedatum</Label>
              <Input id="ret-date" name="requestedAt" type="date" defaultValue={today} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ret-reason">Grund</Label>
              <Input id="ret-reason" name="reason" placeholder="Passt nicht / defekt / …" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ret-refund">Erstattungsbetrag (€)</Label>
              <Input id="ret-refund" name="refundAmount" inputMode="decimal" placeholder="119,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ret-extra">Zusatzkosten (€, z.B. Rückversand)</Label>
              <Input id="ret-extra" name="extraCost" inputMode="decimal" placeholder="4,50" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="restock" className="size-4" />
            Artikel wieder einlagern (Bestand erhöht sich)
          </label>

          <div className="space-y-2">
            <Label htmlFor="ret-notes">Notizen</Label>
            <Input id="ret-notes" name="notes" placeholder="optional" />
          </div>

          <Button type="submit" className="w-full" disabled={pending || sales.length === 0}>
            {pending ? "Wird gespeichert…" : "Retoure erfassen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
