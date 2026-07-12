"use client";

import { useActionState } from "react";
import { ArrowRight, CircleAlert, ShieldCheck } from "lucide-react";
import {
  createOrganizationAction,
  type RegisterState,
} from "@/lib/actions/register";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OrgFields } from "@/components/auth/org-fields";

export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    createOrganizationAction,
    null
  );

  return (
    <form action={formAction} className="auth-form">
      {state?.error && (
        <Alert variant="destructive" id="organization-error" className="auth-form-alert">
          <CircleAlert className="size-4" aria-hidden="true" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <fieldset className="auth-field-group">
        <legend><span>01</span> Organisation</legend>
        <OrgFields />
      </fieldset>
      <Button type="submit" className="auth-submit w-full" disabled={pending}>
        {pending ? "Wird angelegt…" : "Organisation gründen"}
        {!pending && <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>
      <p className="auth-form-proof">
        <ShieldCheck aria-hidden="true" />
        Dein bestehender Zugang bleibt erhalten.
      </p>
    </form>
  );
}
