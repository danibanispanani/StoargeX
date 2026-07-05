"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createCredentialAction } from "@/lib/actions/credentials";
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

export function CreateCredentialDialog({
  platforms,
}: {
  platforms: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCredentialAction,
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
        <Button>Zugangsdaten speichern</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zugangsdaten speichern</DialogTitle>
          <DialogDescription>
            Das Secret wird server-seitig mit AES-256 Envelope Encryption
            verschlüsselt und nie im Klartext gespeichert.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4" autoComplete="off">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="cred-label">Label *</Label>
            <Input id="cred-label" name="label" required placeholder="eBay Hauptaccount" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cred-username">Benutzername</Label>
              <Input id="cred-username" name="username" autoComplete="off" placeholder="shop@firma.de" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cred-platform">Plattform (optional)</Label>
              <select
                id="cred-platform"
                name="platformId"
                defaultValue=""
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Keine</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cred-secret">Secret / Passwort *</Label>
            <Input
              id="cred-secret"
              name="secret"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cred-notes">Notizen</Label>
            <Input id="cred-notes" name="notes" placeholder="optional – keine Secrets hier!" />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Wird verschlüsselt…" : "Verschlüsselt speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
