import { requireOrg } from "@/lib/org";
import { formatEuro, parseSurcharges } from "@/lib/calculations";
import { deriveConsignmentStockStatus } from "@/lib/services/consignment-service";
import { CreateConsignmentDialog } from "@/components/consignment/create-consignment-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { ConsignmentRowActions } from "@/components/consignment/consignment-row-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ConsignmentPage() {
  const { db } = await requireOrg();

  const [inventoryPositions, legacyItems, recentSales] = await Promise.all([
    db.inventoryPosition.findMany({
      where: { inventoryType: "CONSIGNMENT" },
      include: {
        product: true,
        consignmentLot: true,
      },
      orderBy: { receivedAt: "desc" },
      take: 200,
    }),
    db.consignmentInventory.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.sale.findMany({
      include: { stockItem: { select: { title: true } } },
      orderBy: { soldAt: "desc" },
      take: 500,
    }),
  ]);

  const allLinkedIds = [...new Set(legacyItems.flatMap((item) => item.linkedSaleIds))];
  const linkedSales = allLinkedIds.length
    ? await db.sale.findMany({
        where: { id: { in: allLinkedIds } },
        select: { id: true, salePriceCents: true, profitCents: true },
      })
    : [];
  const saleById = new Map(linkedSales.map((sale) => [sale.id, sale]));

  const inventoryRows = inventoryPositions
    .filter((position) => position.consignmentLot)
    .map((position) => {
      const lot = position.consignmentLot!;
      const priceTiers = parseSurcharges(lot.channelPrices);
      return {
        source: "inventory" as const,
        id: position.id,
        sku: position.inventoryNumber,
        partner: lot.partnerCompany,
        title: position.product.name,
        subtitle: [position.product.variant, position.product.category, position.product.ean]
          .filter(Boolean)
          .join(" · "),
        quantity: position.quantityAvailable,
        quantityReceived: position.quantityReceived,
        soldQuantity: position.quantitySold,
        returnedQuantity: position.quantityInspection,
        defectiveQuantity: position.quantityDefective,
        costGrossCents: decimalToCents(lot.costGross),
        costNetCents: decimalToCents(lot.costNet),
        priceTiers,
        linkedSaleIds: [] as string[],
        linkedCount: 0,
        revenueCents: 0,
        profitCents: 0,
        status: deriveConsignmentStockStatus(position),
      };
    });

  const legacyRows = legacyItems.map((item) => {
    const linked = item.linkedSaleIds
      .map((id) => saleById.get(id))
      .filter((sale): sale is NonNullable<typeof sale> => Boolean(sale));
    return {
      source: "legacy" as const,
      id: item.id,
      sku: item.sku,
      partner: item.consignorName,
      title: item.itemTitle,
      subtitle: "Legacy ConsignmentInventory",
      quantity: item.quantity,
      quantityReceived:
        item.quantity + item.soldQuantity + item.returnedQuantity + item.defectiveQuantity,
      soldQuantity: item.soldQuantity,
      returnedQuantity: item.returnedQuantity,
      defectiveQuantity: item.defectiveQuantity,
      costGrossCents: item.agreedPayoutCents,
      costNetCents: null,
      priceTiers: parseSurcharges(item.priceTiers),
      linkedSaleIds: item.linkedSaleIds,
      linkedCount: linked.length,
      revenueCents: linked.reduce((sum, sale) => sum + sale.salePriceCents, 0),
      profitCents: linked.reduce((sum, sale) => sum + sale.profitCents, 0),
      status: "Legacy",
    };
  });

  const rows = [...inventoryRows, ...legacyRows];

  const saleOptions = recentSales.map((sale) => ({
    id: sale.id,
    label: `${sale.orderNumber ?? sale.id.slice(0, 8)} – ${
      sale.stockItem?.title ?? "Mehrartikel-Verkauf"
    } (${formatEuro(sale.salePriceCents)})`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Konsignation</h1>
          <p className="text-sm text-muted-foreground">
            Eigener Bereich für Fremdbestand. Neue Einträge laufen über K-Nummer,
            InventoryPosition, ConsignmentLot und Movement-Historie.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ImportExportBar table="konsignation" />
          <CreateConsignmentDialog />
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konsi-Nr.</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Artikel</TableHead>
                  <TableHead className="text-right">Verfügbar / erhalten</TableHead>
                  <TableHead className="text-right">Verkauft</TableHead>
                  <TableHead className="text-right">Retoure/Prüfung</TableHead>
                  <TableHead className="text-right">Defekt</TableHead>
                  <TableHead>EK</TableHead>
                  <TableHead>Channel-Preise</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                      Noch keine Konsignationsware erfasst. Neue Ware wird als
                      K-Position im gemeinsamen Inventory geführt.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={`${row.source}:${row.id}`}>
                    <TableCell className="font-mono text-xs">
                      <div>{row.sku}</div>
                      {row.source === "legacy" && (
                        <span className="text-[10px] uppercase text-muted-foreground">
                          Legacy
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{row.partner}</TableCell>
                    <TableCell className="max-w-64">
                      <div className="truncate font-medium">{row.title}</div>
                      {row.subtitle && (
                        <div className="truncate text-xs text-muted-foreground">
                          {row.subtitle}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.quantity} / {row.quantityReceived}
                    </TableCell>
                    <TableCell className="text-right">{row.soldQuantity}</TableCell>
                    <TableCell className="text-right">{row.returnedQuantity}</TableCell>
                    <TableCell className="text-right">{row.defectiveQuantity}</TableCell>
                    <TableCell className="text-xs">
                      {row.costGrossCents != null ? (
                        <>
                          <div>Brutto {formatEuro(row.costGrossCents)}</div>
                          {row.costNetCents != null && (
                            <div className="text-muted-foreground">
                              Netto {formatEuro(row.costNetCents)}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 text-xs text-muted-foreground">
                      {row.priceTiers.length
                        ? row.priceTiers
                            .map((tier) => `${tier.label}: ${formatEuro(tier.cents)}`)
                            .join(" · ")
                        : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.source === "legacy" ? "secondary" : "outline"}>
                        {row.status}
                      </Badge>
                      {row.linkedCount > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatEuro(row.revenueCents)} · Marge {formatEuro(row.profitCents)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <ConsignmentRowActions
                        item={{
                          id: row.id,
                          sku: row.sku,
                          source: row.source,
                          inventoryPositionId: row.source === "inventory" ? row.id : undefined,
                          quantity: row.quantity,
                          soldQuantity: row.soldQuantity,
                          returnedQuantity: row.returnedQuantity,
                          defectiveQuantity: row.defectiveQuantity,
                          linkedSaleIds: row.linkedSaleIds,
                        }}
                        saleOptions={saleOptions}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function decimalToCents(value: unknown): number | null {
  if (value == null) return null;
  return Math.round(Number(value) * 100);
}
