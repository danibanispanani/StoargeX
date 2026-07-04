"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptInvitationAction } from "@/lib/actions/invitation";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AcceptInvitationForm({
  token,
  needsAccount,
  wrongAccount,
  accountExists,
  email,
}: {
  token: string;
  needsAccount: boolean;
  wrongAccount: boolean;
  accountExists: boolean;
  email: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    acceptInvitationAction,
    null
  );

  if (wrongAccount) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Du bist mit einem anderen Konto angemeldet. Diese Einladung gilt für{" "}
          {email}. Bitte melde dich ab und mit dem richtigen Konto an.
        </AlertDescription>
      </Alert>
    );
  }

  if (accountExists) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Für {email} existiert bereits ein Konto. Bitte melde dich an und
          öffne den Einladungslink danach erneut.
        </p>
        <Button asChild className="w-full">
          <Link href={`/login?callbackUrl=/einladung/${token}`}>Anmelden</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="token" value={token} />
      {needsAccount && (
        <>
          <div className="space-y-2">
            <Label htmlFor="name">Dein Name</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort (mind. 12 Zeichen)</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </div>
        </>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Wird angenommen…" : "Einladung annehmen"}
      </Button>
    </form>
  );
}
