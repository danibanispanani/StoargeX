"use client";

import { useActionState } from "react";
import { ArrowRight, CircleAlert, ShieldCheck } from "lucide-react";
import { registerAction, type RegisterState } from "@/lib/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OrgFields } from "@/components/auth/org-fields";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerAction,
    null
  );

  return (
    <form action={formAction} className="auth-form">
      {state?.error && (
        <Alert variant="destructive" id="register-error" className="auth-form-alert">
          <CircleAlert className="size-4" aria-hidden="true" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="auth-field-group">
        <legend><span>01</span> Persönlicher Zugang</legend>
        <div className="auth-field">
          <Label htmlFor="name">Dein Name</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="auth-field">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@organisation.de"
          />
        </div>
        <div className="auth-field">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            aria-describedby="password-requirement"
          />
          <p id="password-requirement" className="auth-field-note">Mindestens 12 Zeichen.</p>
        </div>
      </fieldset>

      <fieldset className="auth-field-group">
        <legend><span>02</span> Organisation</legend>
        <OrgFields />
      </fieldset>

      <Button type="submit" className="auth-submit w-full" disabled={pending}>
        {pending ? "Wird angelegt…" : "Organisation gründen"}
        {!pending && <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>
      <p className="auth-form-proof">
        <ShieldCheck aria-hidden="true" />
        Du startest als Inhaber deiner Organisation.
      </p>
    </form>
  );
}
