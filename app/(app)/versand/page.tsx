import { requireOrg } from "@/lib/org";
import { parseSurcharges } from "@/lib/calculations";
import {
  CarrierRateTable,
  type CarrierRate,
} from "@/components/shipping/carrier-rate-table";
import { ShippingRateDialog } from "@/components/shipping/shipping-rate-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import {
  OPERATIONAL_MODULES,
  operationalSearchParams,
  parseOperationalSearchQuery,
  parseOperationalModuleView,
} from "@/lib/operational-modules";
import { OperationalSearchToolbar } from "@/components/table/operational-search-toolbar";

export default async function ShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; q?: string }>;
}) {
  const { db, organization, userId } = await requireOrg();
  const { preset, q: rawQuery } = await searchParams;
  const q = parseOperationalSearchQuery(rawQuery);
  const requestedView = parseOperationalModuleView(OPERATIONAL_MODULES.shipping, preset);

  const rates = await db.shippingRate.findMany({
    where: q
      ? {
          OR: [
            { carrierName: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { zone: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
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
  const visibleRateCount = requestedView === "active"
    ? plainRates.filter((rate) => rate.active).length
    : requestedView === "inactive"
      ? plainRates.filter((rate) => !rate.active).length
      : plainRates.length;

  // Eine Tariftabelle je Dienstleister
  const byCarrier = new Map<string, CarrierRate[]>();
  for (const rate of plainRates) {
    const list = byCarrier.get(rate.carrierName) ?? [];
    list.push(rate);
    byCarrier.set(rate.carrierName, list);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Betrieb"
        title="Versand"
        description="Tarife je Dienstleister, Zone und Gewichtsklasse; im Verkauf nach Zielland aufgelöst."
        actions={<ShippingRateDialog />}
      />
      <OperationalSearchToolbar
        basePath="/versand"
        query={q ?? ""}
        placeholder="Dienstleister, Tarif oder Zone"
        hiddenParams={{ preset: requestedView === "standard" ? undefined : requestedView }}
      />

      <CompactTableShell
        definition={OPERATIONAL_MODULES.shipping}
        scope={{ organizationId: organization.id, userId }}
        currentQuery={operationalSearchParams({
          preset: requestedView === "standard" ? undefined : requestedView,
          q,
        })}
        totalResults={visibleRateCount}
      >
        {byCarrier.size === 0 ? (
          <Card className="rounded-none border-0">
            <CardContent className="py-10 text-center text-muted-foreground">
              Noch keine Tarife angelegt. Lege je Dienstleister Zonen und
              Gewichtsklassen mit Preisen an.
            </CardContent>
          </Card>
        ) : (
          [...byCarrier.entries()].map(([carrier, carrierRates]) => (
            <CarrierRateTable key={carrier} carrier={carrier} rates={carrierRates} />
          ))
        )}
      </CompactTableShell>
    </div>
  );
}
