import { requireOrg } from "@/lib/org";
import { parseSurcharges } from "@/lib/calculations";
import {
  CarrierRateTable,
  type CarrierRate,
} from "@/components/shipping/carrier-rate-table";
import { ShippingRateDialog } from "@/components/shipping/shipping-rate-dialog";
import { Card, CardContent } from "@/components/ui/card";

export default async function ShippingPage() {
  const { db } = await requireOrg();

  const rates = await db.shippingRate.findMany({
    orderBy: [{ carrierName: "asc" }, { zone: "asc" }, { maxWeightKg: "asc" }],
  });

  const plainRates: CarrierRate[] = rates.map((rate) => ({
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

  // Eine Tariftabelle je Dienstleister
  const byCarrier = new Map<string, CarrierRate[]>();
  for (const rate of plainRates) {
    const list = byCarrier.get(rate.carrierName) ?? [];
    list.push(rate);
    byCarrier.set(rate.carrierName, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Versand</h1>
          <p className="text-sm text-muted-foreground">
            Tarif-Verwaltung je Dienstleister – die Tarife erscheinen im
            Verkauf-Formular, gefiltert nach Zielland.
          </p>
        </div>
        <ShippingRateDialog />
      </div>

      {byCarrier.size === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Noch keine Tarife angelegt. Lege je Dienstleister (DHL, DPD,
            Hermes, GLS, UPS …) Zonen und Gewichtsklassen mit Preisen an –
            wie im bisherigen Excel-Sheet.
          </CardContent>
        </Card>
      )}

      {[...byCarrier.entries()].map(([carrier, carrierRates]) => (
        <CarrierRateTable key={carrier} carrier={carrier} rates={carrierRates} />
      ))}
    </div>
  );
}
