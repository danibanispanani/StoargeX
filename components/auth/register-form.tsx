"use client";

import { useActionState } from "react";
import { registerAction, type RegisterState } from "@/lib/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OrgFields } from "@/components/auth/org-fields";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerAction,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Dein Name</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
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

      <Separator />
      <OrgFields />

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Wird angelegt…" : "Organisation gründen"}
      </Button>
    </form>
  );
}
