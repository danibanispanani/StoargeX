"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createDebtAction } from "@/lib/actions/debts";
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

export function CreateDebtDialog({ memberNames }: { memberNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createDebtAction,
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
        <Button>Eintrag anlegen</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forderung / Verbindlichkeit anlegen</DialogTitle>
          <DialogDescription>
            Wer schuldet wem wie viel? Gesellschafter aus der Liste wählen
            oder frei eintragen.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <datalist id="debt-members">
            {memberNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="debt-date">Datum</Label>
              <Input id="debt-date" name="debtDate" type="date" defaultValue={today} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-amount">Betrag (€) *</Label>
              <Input id="debt-amount" name="amount" required inputMode="decimal" placeholder="50,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-debtor">Schuldner *</Label>
              <Input id="debt-debtor" name="debtorName" required list="debt-members" placeholder="Max" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-creditor">Gläubiger *</Label>
              <Input id="debt-creditor" name="creditorName" required list="debt-members" placeholder="Moritz" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-desc">Beschreibung *</Label>
            <Input
              id="debt-desc"
              name="description"
              required
              placeholder="Auslage Wareneinkauf Flohmarkt"
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Wird gespeichert…" : "Eintrag anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
