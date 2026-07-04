"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import type { LegalForm } from "@prisma/client";
import { updateOrganizationAction } from "@/lib/actions/organization";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OrganizationFormData {
  name: string;
  legalForm: LegalForm;
  vatId: string;
  taxNumber: string;
  street: string;
  zipCode: string;
  city: string;
}

export function OrganizationForm({
  organization,
  readOnly,
}: {
  organization: OrganizationFormData;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateOrganizationAction,
    null
  );

  useEffect(() => {
    if (state?.success) toast.success(state.success);
  }, [state]);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Firmenname</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={organization.name}
          disabled={readOnly}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="legalForm">Rechtsform</Label>
          <select
            id="legalForm"
            name="legalForm"
            defaultValue={organization.legalForm}
            disabled={readOnly}
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="GBR">GbR</option>
            <option value="EINZELUNTERNEHMEN">Einzelunternehmen</option>
            <option value="UG">UG (haftungsbeschränkt)</option>
            <option value="GMBH">GmbH</option>
            <option value="SONSTIGE">Sonstige</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatId">USt-IdNr.</Label>
          <Input
            id="vatId"
            name="vatId"
            defaultValue={organization.vatId}
            placeholder="DE123456789"
            disabled={readOnly}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="taxNumber">Steuernummer</Label>
        <Input
          id="taxNumber"
          name="taxNumber"
          defaultValue={organization.taxNumber}
          disabled={readOnly}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="street">Straße und Hausnummer</Label>
        <Input
          id="street"
          name="street"
          defaultValue={organization.street}
          disabled={readOnly}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <div className="space-y-2">
          <Label htmlFor="zipCode">PLZ</Label>
          <Input
            id="zipCode"
            name="zipCode"
            defaultValue={organization.zipCode}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Ort</Label>
          <Input
            id="city"
            name="city"
            defaultValue={organization.city}
            disabled={readOnly}
          />
        </div>
      </div>

      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gespeichert…" : "Speichern"}
        </Button>
      )}
    </form>
  );
}
