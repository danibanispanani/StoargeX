"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteOrganizationAction,
  exportOrganizationDataAction,
} from "@/lib/actions/gdpr";
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

export function GdprCard({ organizationName }: { organizationName: string }) {
  const [exporting, startExport] = useTransition();

  function exportData() {
    startExport(async () => {
      const result = await exportOrganizationDataAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export heruntergeladen.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-4">
        <div>
          <p className="font-medium">Datenexport (Art. 15/20 DSGVO)</p>
          <p className="text-sm text-muted-foreground">
            Relationalen Organisationskern als JSON herunterladen. Credential-,
            Auth-, Token-, Passwort-, TOTP- und Recovery-Secrets sind nicht enthalten.
          </p>
        </div>
        <Button variant="outline" onClick={exportData} disabled={exporting}>
          {exporting ? "Wird erstellt…" : "Daten exportieren"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 p-4">
        <div>
          <p className="font-medium text-destructive">
            Organisation löschen (Art. 17 DSGVO)
          </p>
          <p className="text-sm text-muted-foreground">
            Löscht die Organisation mit allen Daten unwiderruflich –
            Lager, Verkäufe, Team, Audit-Log, Uploads.
          </p>
        </div>
        <DeleteOrgDialog organizationName={organizationName} />
      </div>
    </div>
  );
}

function DeleteOrgDialog({ organizationName }: { organizationName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteOrganizationAction,
    null
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Organisation löschen</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Organisation unwiderruflich löschen</DialogTitle>
          <DialogDescription>
            Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten der
            Organisation werden gelöscht. Tippe zur Bestätigung den exakten
            Namen ein: <strong>{organizationName}</strong>
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="confirm-name">Organisationsname</Label>
            <Input
              id="confirm-name"
              name="confirmName"
              required
              placeholder={organizationName}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="destructive" className="w-full" disabled={pending}>
            {pending ? "Wird gelöscht…" : "Endgültig löschen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
