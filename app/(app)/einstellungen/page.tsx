import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import { OrganizationForm } from "@/components/settings/organization-form";
import { TaxRatesCard } from "@/components/settings/tax-rates-card";
import { OrderFormatForm } from "@/components/settings/order-format-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const { organization, membership, db } = await requireOrg();
  const canEdit = hasMinRole(membership.role, "ADMIN");

  const taxRates = await db.taxRate.findMany({
    orderBy: [{ country: "asc" }, { name: "asc" }],
  });

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
          <CardTitle>Umsatzsteuersätze</CardTitle>
          <CardDescription>
            USt-Satz je Käuferland für die VK-netto-Berechnung im Verkauf.
            Ohne Länder-Treffer greift der Default-Satz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxRatesCard
            rates={taxRates.map((rate) => ({
              id: rate.id,
              name: rate.name,
              ratePercent: Number(rate.ratePercent),
              country: rate.country,
              isDefault: rate.isDefault,
            }))}
            readOnly={!canEdit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order-IDs</CardTitle>
          <CardDescription>
            Format der automatisch vergebenen, lesbaren Order-IDs für Verkäufe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrderFormatForm
            currentFormat={organization.orderIdFormat}
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
