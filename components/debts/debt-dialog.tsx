"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createDebtAction, updateDebtAction } from "@/lib/actions/debts";
import type { ActionState } from "@/lib/actions/team";
import { DEBT_KIND_LABELS, DEBT_STATUS, DEBT_STATUS_OPTIONS } from "@/lib/constants";
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

export interface EditableDebt {
  id: string;
  debtDate: string;
  refId: string;
  description: string;
  kind: string;
  quantity: number;
  amount: string;
  debtorName: string;
  creditorName: string;
  status: string;
  entryStatus: string;
  settledAt: string;
  notes: string;
}

export function DebtDialog({
  debt,
  memberNames,
  trigger,
}: {
  debt?: EditableDebt;
  memberNames: string[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = debt ? updateDebtAction.bind(null, debt.id) : createDebtAction;
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

  const today = new Date().toISOString().slice(0, 10);
  const partyOptions = [...new Set(["GbR", "Richard", "Daniel", ...memberNames])];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>Schuld manuell eintragen</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {debt ? "Schulden-Eintrag bearbeiten" : "Schuld manuell eintragen"}
          </DialogTitle>
          <DialogDescription>
            Kauf-/Verkaufs-Einträge entstehen auch automatisch über ZM bzw.
            Auszahlungsempfänger.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <datalist id="debt-parties">
            {partyOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="debt-date">Datum</Label>
              <Input id="debt-date" name="debtDate" type="date" defaultValue={debt?.debtDate ?? today} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-ref">ID (Lager-/Order-ID)</Label>
              <Input id="debt-ref" name="refId" defaultValue={debt?.refId} placeholder="z.B. L-26-042" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-kind">Art</Label>
              <select
                id="debt-kind"
                name="kind"
                defaultValue={debt?.kind ?? "SONSTIGES"}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {Object.entries(DEBT_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-desc">Artikelbeschreibung *</Label>
            <Input
              id="debt-desc"
              name="description"
              required
              defaultValue={debt?.description}
              placeholder="z.B. Amazon Fire TV Stick 4K"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="debt-qty">Menge</Label>
              <Input id="debt-qty" name="quantity" type="number" min={1} defaultValue={debt?.quantity ?? 1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-amount">Betrag (€) *</Label>
              <Input id="debt-amount" name="amount" required inputMode="decimal" defaultValue={debt?.amount} placeholder="z.B. 50,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-debtor">Schuldner *</Label>
              <Input id="debt-debtor" name="debtorName" required list="debt-parties" defaultValue={debt?.debtorName} placeholder="z.B. GbR" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-creditor">Empfänger *</Label>
              <Input id="debt-creditor" name="creditorName" required list="debt-parties" defaultValue={debt?.creditorName} placeholder="z.B. Richard" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-status">Status</Label>
              <select
                id="debt-status"
                name="status"
                defaultValue={debt?.status ?? "OPEN"}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {DEBT_STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {DEBT_STATUS[value].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-entry">Eintrag</Label>
              <select
                id="debt-entry"
                name="entryStatus"
                defaultValue={debt?.entryStatus ?? "IO"}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="IO">I.O</option>
                <option value="FEHLT">Fehlt</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-settled">Begleichungsdatum</Label>
              <Input
                id="debt-settled"
                name="settledAt"
                type="date"
                defaultValue={debt?.settledAt}
              />
              <p className="text-xs text-muted-foreground">
                Nur relevant bei Status „Beglichen&ldquo; (leer = heute).
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-notes">Kommentar</Label>
            <Input id="debt-notes" name="notes" defaultValue={debt?.notes} placeholder="optional" />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert…" : debt ? "Änderungen speichern" : "Schuld eintragen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
