import { requireOrg } from "@/lib/org";
import { parseSurcharges, type ShippingRateLike } from "@/lib/calculations";
import { ShippingCalculator } from "@/components/shipping/shipping-calculator";
import { ShippingRatesTable } from "@/components/shipping/shipping-rates-table";
import { CreateShippingRateDialog } from "@/components/shipping/create-shipping-rate-dialog";

export default async function ShippingPage() {
  const { db } = await requireOrg();

  const rates = await db.shippingRate.findMany({
    orderBy: [{ carrierName: "asc" }, { name: "asc" }],
  });

  // Für Client-Komponenten serialisieren (Decimal -> number, Json -> Surcharge[])
  const plainRates: Array<ShippingRateLike & { id: string; active: boolean }> =
    rates.map((rate) => ({
      id: rate.id,
      carrierName: rate.carrierName,
      name: rate.name,
      zone: rate.zone,
      countries: rate.countries,
      baseCents: rate.baseCents,
      perKgCents: rate.perKgCents,
      maxWeightKg: rate.maxWeightKg === null ? null : Number(rate.maxWeightKg),
      surcharges: parseSurcharges(rate.surcharges),
      active: rate.active,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Versand</h1>
          <p className="text-sm text-muted-foreground">
            Editierbare Tarife für DHL, DPD, Hermes, GLS, UPS &amp; Co. – der
            Kalkulator schlägt aus Zielland und Gewicht passende Tarife vor.
          </p>
        </div>
        <CreateShippingRateDialog />
      </div>

      <ShippingCalculator rates={plainRates} />
      <ShippingRatesTable rates={plainRates} />
    </div>
  );
}
