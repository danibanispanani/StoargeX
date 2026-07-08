import { requireOrg } from "@/lib/org";
import { formatEuro, parseSurcharges } from "@/lib/calculations";
import { deriveConsignmentStockStatus } from "@/lib/services/consignment-service";
import { CreateConsignmentDialog } from "@/components/consignment/create-consignment-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { ConsignmentRowActions } from "@/components/consignment/consignment-row-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import {
  DetailDrawer,
  DetailGrid,
  DetailSection,
} from "@/components/table/detail-drawer";
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

  function ConsignmentDetailDrawer({ row }: { row: (typeof rows)[number] }) {
    return (
      <DetailDrawer title={row.sku} description={`${row.partner} · ${row.title}`}>
        <DetailSection title="Artikel">
          <DetailGrid
            items={[
              { label: "Partner", value: row.partner },
              { label: "Artikel", value: row.title },
              { label: "Zusatzinfo", value: row.subtitle || "–" },
              { label: "Quelle", value: row.source === "legacy" ? "Legacy" : "InventoryPosition" },
            ]}
          />
        </DetailSection>
        <DetailSection title="Bestand">
          <DetailGrid
            items={[
              { label: "Verfügbar", value: row.quantity },
              { label: "Erhalten", value: row.quantityReceived },
              { label: "Verkauft", value: row.soldQuantity },
              { label: "Prüfung", value: row.returnedQuantity },
              { label: "Defekt", value: row.defectiveQuantity },
              { label: "Status", value: row.status },
            ]}
          />
        </DetailSection>
        <DetailSection title="Finanzen und Channel-Preise">
          <DetailGrid
            items={[
              { label: "EK brutto", value: row.costGrossCents != null ? formatEuro(row.costGrossCents) : "–" },
              { label: "EK netto", value: row.costNetCents != null ? formatEuro(row.costNetCents) : "–" },
              {
                label: "Preise",
                value: row.priceTiers.length
                  ? row.priceTiers.map((tier) => `${tier.label}: ${formatEuro(tier.cents)}`).join(" · ")
                  : "–",
              },
              { label: "Verknüpfte Verkäufe", value: row.linkedCount },
            ]}
          />
        </DetailSection>
      </DetailDrawer>
    );
  }

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

      <CompactTableShell
        storageKey="konsignation"
        views={[
          { value: "standard", label: "Standard" },
          { value: "preise", label: "Channel-Preise" },
          { value: "bestand", label: "Bestand" },
          { value: "all", label: "Alle Spalten" },
        ]}
      >
      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="sx-datatable">
              <TableHeader>
                <TableRow>
                  <TableHead data-column data-view-standard data-view-preise data-view-bestand data-view-all>K-Nummer</TableHead>
                  <TableHead data-column data-view-standard data-view-all>Partner</TableHead>
                  <TableHead data-column data-view-standard data-view-preise data-view-bestand data-view-all>Artikel</TableHead>
                  <TableHead data-column data-view-standard data-view-bestand data-view-all className="text-right">Bestand</TableHead>
                  <TableHead data-column data-view-standard data-view-bestand data-view-all className="text-right">Verkauft</TableHead>
                  <TableHead data-column data-view-standard data-view-bestand data-view-all className="text-right">Prüfung</TableHead>
                  <TableHead data-column data-view-standard data-view-bestand data-view-all className="text-right">Defekt</TableHead>
                  <TableHead data-column data-view-standard data-view-preise data-view-all>EK</TableHead>
                  <TableHead data-column data-view-preise data-view-all>Channel-Preise</TableHead>
                  <TableHead data-column data-view-bestand data-view-all>Status</TableHead>
                  <TableHead data-column data-view-standard data-view-preise data-view-bestand data-view-all className="w-48 text-right">Aktionen</TableHead>
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
                    <TableCell data-column data-view-standard data-view-preise data-view-bestand data-view-all className="font-mono text-xs">
                      <div>{row.sku}</div>
                      {row.source === "legacy" && (
                        <span className="text-[10px] uppercase text-muted-foreground">
                          Legacy
                        </span>
                      )}
                    </TableCell>
                    <TableCell data-column data-view-standard data-view-all>{row.partner}</TableCell>
                    <TableCell data-column data-view-standard data-view-preise data-view-bestand data-view-all className="sx-cell-primary max-w-64">
                      <div className="truncate font-medium">{row.title}</div>
                      {row.subtitle && (
                        <div className="truncate text-xs text-muted-foreground">
                          {row.subtitle}
                        </div>
                      )}
                    </TableCell>
                    <TableCell data-column data-view-standard data-view-bestand data-view-all className="text-right">
                      {row.quantity} / {row.quantityReceived}
                    </TableCell>
                    <TableCell data-column data-view-standard data-view-bestand data-view-all className="text-right">{row.soldQuantity}</TableCell>
                    <TableCell data-column data-view-standard data-view-bestand data-view-all className="text-right">{row.returnedQuantity}</TableCell>
                    <TableCell data-column data-view-standard data-view-bestand data-view-all className="text-right">{row.defectiveQuantity}</TableCell>
                    <TableCell data-column data-view-standard data-view-preise data-view-all className="text-xs">
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
                    <TableCell data-column data-view-preise data-view-all className="max-w-56 text-xs text-muted-foreground">
                      {row.priceTiers.length
                        ? row.priceTiers
                            .map((tier) => `${tier.label}: ${formatEuro(tier.cents)}`)
                            .join(" · ")
                        : "–"}
                    </TableCell>
                    <TableCell data-column data-view-bestand data-view-all>
                      <Badge variant={row.source === "legacy" ? "secondary" : "outline"}>
                        {row.status}
                      </Badge>
                      {row.linkedCount > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatEuro(row.revenueCents)} · Marge {formatEuro(row.profitCents)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell data-column data-view-standard data-view-preise data-view-bestand data-view-all>
                      <div className="flex justify-end gap-1">
                        <ConsignmentDetailDrawer row={row} />
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </CompactTableShell>
    </div>
  );
}

function decimalToCents(value: unknown): number | null {
  if (value == null) return null;
  return Math.round(Number(value) * 100);
}
