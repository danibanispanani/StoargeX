import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { PageToolbar } from "@/components/app/page-toolbar";
import { hasMinRole } from "@/lib/roles";
import { OrganizationForm } from "@/components/settings/organization-form";
import { TaxRatesCard } from "@/components/settings/tax-rates-card";
import { OrderFormatForm } from "@/components/settings/order-format-form";
import { GdprCard } from "@/components/settings/gdpr-card";
import { LowStockCard } from "@/components/settings/low-stock-card";
import { BillingCard } from "@/components/settings/billing-card";
import { getFeatureAccess } from "@/lib/feature-access";
import {
  FEATURE_KEYS,
  toFeatureEntitlementSnapshot,
} from "@/lib/services/feature-entitlement-service";
import { configuredConsignmentTrialDays } from "@/lib/billing-config";
import { ThemeSelector } from "@/components/theme/theme-selector";
import {
  OptionListCard,
  PlatformsCard,
} from "@/components/settings/dropdown-options-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const context = await requireOrg();
  const { organization, membership, db } = context;
  const canEdit = hasMinRole(membership.role, "ADMIN");

  const [taxRates, platforms, zmOptions, payoutOptions, taskAreaOptions, storageLocationOptions, consignmentDecision] = await Promise.all([
    db.taxRate.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }] }),
    db.platform.findMany({ orderBy: { name: "asc" } }),
    db.selectOption.findMany({
      where: { kind: "PAYMENT_METHOD", active: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.selectOption.findMany({
      where: { kind: "PAYOUT_RECIPIENT", active: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.selectOption.findMany({
      where: { kind: "TASK_AREA", active: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.selectOption.findMany({
      where: { kind: "STORAGE_LOCATION", active: true },
      orderBy: { sortOrder: "asc" },
    }),
    getFeatureAccess(context, FEATURE_KEYS.CONSIGNMENT),
  ]);
  const consignmentAccess = toFeatureEntitlementSnapshot(consignmentDecision);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verwaltung"
        title="Einstellungen"
        description="Organisation, Konten, operative Auswahlwerte, Abrechnung und Sicherheit."
      />

      <PageToolbar
        primary={
          <>
            <Button asChild variant="ghost" size="sm"><Link href="/einstellungen">Organisation</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/einstellungen/marktplatzkonten">Marktplatzkonten</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/einstellungen/sicherheit">Sicherheit</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/team">Team</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/zugangsdaten">Zugangsdaten</Link></Button>
          </>
        }
      />

      <Card className="rounded-none border-x-0 shadow-none">
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

      <Card className="rounded-none border-x-0 shadow-none">
        <CardHeader>
          <CardTitle>Darstellung</CardTitle>
          <CardDescription>
            Hell, dunkel oder Systemeinstellung – wird an deinem Konto
            gespeichert und gilt auf allen Geräten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 shadow-none">
        <CardHeader>
          <CardTitle>Abo &amp; Abrechnung</CardTitle>
          <CardDescription>
            Basistarif, separat buchbare Add-ons, Testphasen und
            Stripe-Verwaltung der Organisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillingCard
            tier={organization.subscriptionTier}
            hasSubscription={Boolean(organization.stripeCustomerId)}
            isOwner={membership.role === "OWNER"}
            consignmentAccess={consignmentAccess}
            consignmentTrialDays={configuredConsignmentTrialDays()}
          />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 shadow-none">
        <CardHeader>
          <CardTitle>Plattformen &amp; Accounts</CardTitle>
          <CardDescription>
            Verkaufsplattformen bzw. Accounts (z.B. eBay R / eBay D) – erscheinen
            als Listing-Spalten im Lager und als Plattform-Auswahl im Verkauf.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="mb-4">
            <Link href="/einstellungen/marktplatzkonten">Marktplatzkonten verwalten</Link>
          </Button>
          <PlatformsCard
            platforms={platforms.map((p) => ({
              id: p.id,
              name: p.name,
              active: p.active,
            }))}
            readOnly={!canEdit}
          />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 shadow-none">
        <CardHeader>
          <CardTitle>Zahlungsmethoden (ZM)</CardTitle>
          <CardDescription>
            Auswahlwerte im Lager. Werte außerhalb „Firma…&ldquo; erzeugen beim
            Wareneingang automatisch einen Schulden-Eintrag.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionListCard
            kind="PAYMENT_METHOD"
            options={zmOptions.map((o) => ({ id: o.id, label: o.label }))}
            readOnly={!canEdit}
            placeholder="z.B. Firma Konto 2"
          />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 shadow-none">
        <CardHeader>
          <CardTitle>Auszahlungsempfänger</CardTitle>
          <CardDescription>
            Auswahlwerte im Verkauf (freie Eingabe bleibt zusätzlich möglich).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionListCard
            kind="PAYOUT_RECIPIENT"
            options={payoutOptions.map((o) => ({ id: o.id, label: o.label }))}
            readOnly={!canEdit}
            placeholder="z.B. PayPal D"
          />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 shadow-none">
        <CardHeader>
          <CardTitle>Aufgaben-Bereiche</CardTitle>
          <CardDescription>
            Feste Bereichs-Optionen für Aufgaben – freie Eingabe im
            Aufgaben-Dialog bleibt zusätzlich möglich.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionListCard
            kind="TASK_AREA"
            options={taskAreaOptions.map((o) => ({ id: o.id, label: o.label }))}
            readOnly={!canEdit}
            placeholder="z.B. Marketing"
          />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 shadow-none">
        <CardHeader>
          <CardTitle>Lagerstandorte</CardTitle>
          <CardDescription>
            Verwaltete Lagerplätze für Wareneingang und Lagerpositionen. Entfernte
            Werte bleiben bei historischen Positionen lesbar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionListCard
            kind="STORAGE_LOCATION"
            options={storageLocationOptions.map((o) => ({ id: o.id, label: o.label }))}
            readOnly={!canEdit}
            placeholder="z.B. Halle A · Regal 3"
          />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 shadow-none">
        <CardHeader>
          <CardTitle>Lager-Warnschwelle</CardTitle>
          <CardDescription>
            Ab dieser Restmenge (nicht verkaufte Einheiten eines Modells) warnt
            das Dashboard vor niedrigem Bestand. Standard: 1.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LowStockCard threshold={organization.lowStockThreshold} readOnly={!canEdit} />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 shadow-none">
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

      <Card className="rounded-none border-x-0 shadow-none">
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

      <Card className="rounded-none border-x-0 shadow-none">
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

      {membership.role === "OWNER" && (
        <Card id="daten-dsgvo">
          <CardHeader>
            <CardTitle>Daten &amp; DSGVO</CardTitle>
            <CardDescription>
              Datenexport und vollständige Löschung der Organisation (nur
              Inhaber).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GdprCard organizationName={organization.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
