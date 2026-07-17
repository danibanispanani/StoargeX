import { Check, Minus } from "lucide-react";
import { TIERS } from "@/lib/billing";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { ConsignmentAddonPricing } from "@/components/marketing/consignment-addon-pricing";
import { Reveal } from "@/components/marketing/reveal";
import {
  MarketingFooter,
  MarketingNav,
} from "@/components/marketing/marketing-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { configuredConsignmentTrialDays } from "@/lib/billing-config";

// Feature-Vergleich (eigener Entwurf – "Abschnitt 7" des Briefings lag nicht
// vor; zentral anpassbar). true = enthalten, string = Detailangabe.
const COMPARISON: Array<{ feature: string; free: boolean | string; pro: boolean | string; business: boolean | string }> = [
  { feature: "Lager & Wareneingang", free: true, pro: true, business: true },
  { feature: "Verkäufe mit Steuer-Automatik", free: true, pro: true, business: true },
  { feature: "Retouren mit Verlustrechnung", free: true, pro: true, business: true },
  { feature: "Aufgaben-Board & Schulden", free: true, pro: true, business: true },
  { feature: "Teammitglieder", free: "2", pro: "Unbegrenzt", business: "Unbegrenzt" },
  { feature: "Berichte & KPI-Auswertungen", free: false, pro: true, business: true },
  { feature: "Versandtarife & Kalkulator", free: false, pro: true, business: true },
  { feature: "Konsignation (Fremdfirmen-Ware)", free: "Add-on", pro: "Add-on", business: "Enthalten" },
  { feature: "Zugangsdaten-Tresor (AES-256)", free: false, pro: false, business: true },
  { feature: "Support", free: "Community", pro: "E-Mail", business: "Priorität" },
];

function ComparisonCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto size-4 text-transit-teal" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/50" />;
  return <span className="text-sm">{value}</span>;
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string; erforderlich?: string }>;
}) {
  const { feature, erforderlich } = await searchParams;
  const isConsignmentFeature =
    feature?.toLocaleLowerCase("de").includes("konsignation") ?? false;
  const trialDays = configuredConsignmentTrialDays();

  return (
    <div className="public-shell flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h1 className="text-center font-display text-4xl font-bold">
              Preise
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
              Kostenlos starten, jederzeit upgraden. Jährliche Zahlung spart
              zwei Monatsbeiträge.
            </p>
          </Reveal>

          {feature && (
            <Alert className="mx-auto mt-6 max-w-xl border-cargo-amber/50">
              <AlertDescription>
                {isConsignmentFeature ? (
                  <>
                    <strong>Konsignation</strong> ist in Business enthalten und
                    zu Free oder Pro separat als Add-on mit Testphase
                    aktivierbar.
                  </>
                ) : (
                  <>
                    <strong>{feature}</strong> ist ab dem{" "}
                    <strong>
                      {erforderlich === "BUSINESS" ? "Business" : "Pro"}
                    </strong>
                    -Plan verfügbar.
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-10">
            <PricingTiers tiers={TIERS} />
            <ConsignmentAddonPricing trialDays={trialDays} />
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-16">
          <Reveal>
            <h2 className="text-center font-display text-2xl font-bold">
              Alle Funktionen im Vergleich
            </h2>
            <Card className="mt-6">
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funktion</TableHead>
                      <TableHead className="text-center">Free</TableHead>
                      <TableHead className="text-center">Pro</TableHead>
                      <TableHead className="text-center">Business</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPARISON.map((row) => (
                      <TableRow key={row.feature} className="hover-lift">
                        <TableCell className="font-medium">{row.feature}</TableCell>
                        <TableCell className="text-center">
                          <ComparisonCell value={row.free} />
                        </TableCell>
                        <TableCell className="text-center">
                          <ComparisonCell value={row.pro} />
                        </TableCell>
                        <TableCell className="text-center">
                          <ComparisonCell value={row.business} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
