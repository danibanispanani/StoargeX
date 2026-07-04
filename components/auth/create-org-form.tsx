"use client";

import { useActionState } from "react";
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
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <OrgFields />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Wird angelegt…" : "Organisation gründen"}
      </Button>
    </form>
  );
}
