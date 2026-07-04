import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import { OrganizationForm } from "@/components/settings/organization-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const { organization, membership } = await requireOrg();
  const canEdit = hasMinRole(membership.role, "ADMIN");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">
          Firmendaten und Sicherheit
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Firmendaten</CardTitle>
          <CardDescription>
            {canEdit
              ? "Name, Rechtsform, USt-IdNr. und Anschrift der Organisation."
              : "Nur Inhaber und Administratoren können Firmendaten ändern."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm
            organization={{
              name: organization.name,
              legalForm: organization.legalForm,
              vatId: organization.vatId ?? "",
              taxNumber: organization.taxNumber ?? "",
              street: organization.street ?? "",
              zipCode: organization.zipCode ?? "",
              city: organization.city ?? "",
            }}
            readOnly={!canEdit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sicherheit</CardTitle>
          <CardDescription>
            Zwei-Faktor-Authentifizierung (TOTP) für dein Konto verwalten.
            Für Inhaber und Administratoren ist 2FA verpflichtend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/einstellungen/sicherheit">2FA verwalten</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
