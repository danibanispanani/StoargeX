import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Gemeinsame Organisations-Felder für Registrierung und Nachgründung. */
export function OrgFields() {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="organizationName">Firmenname</Label>
        <Input
          id="organizationName"
          name="organizationName"
          required
          placeholder="Mustermann & Partner GbR"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="legalForm">Rechtsform</Label>
        <select
          id="legalForm"
          name="legalForm"
          defaultValue="GBR"
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
        <Label htmlFor="vatId">USt-IdNr. (optional)</Label>
        <Input id="vatId" name="vatId" placeholder="DE123456789" />
      </div>
    </>
  );
}
