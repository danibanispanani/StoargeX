import { requireOrg } from "@/lib/org";
import { getFeatureAccess } from "@/lib/feature-access";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";
import { formatEuro } from "@/lib/calculations";
import { deriveConsignmentStockStatus } from "@/lib/services/consignment-service";
import { CreateConsignmentDialog } from "@/components/consignment/create-consignment-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { ConsignmentRowActions } from "@/components/consignment/consignment-row-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import { FeatureGate } from "@/components/app/feature-gate";
import { PageHeader } from "@/components/app/page-header";
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
import {
  OPERATIONAL_MODULES,
  operationalSearchParams,
  parseOperationalSearchQuery,
  parseOperationalModuleView,
} from "@/lib/operational-modules";
import { OperationalSearchToolbar } from "@/components/table/operational-search-toolbar";

export default async function ConsignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; q?: string }>;
}) {
  const context = await requireOrg();
  const { preset, q: rawQuery } = await searchParams;
  const q = parseOperationalSearchQuery(rawQuery);
  const requestedView = parseOperationalModuleView(
    OPERATIONAL_MODULES.consignment,
    preset
  );
  const access = await getFeatureAccess(context, FEATURE_KEYS.CONSIGNMENT);
  if (!access.enabled) {
    return (
      <FeatureGate
        featureName="Konsignation"
        description="Fremdbestand, Partnerabrechnung und K-Nummern bleiben vollständig erhalten. Aktiviere das Add-on, um die operativen Workflows wieder zu öffnen."
        ctaHref="/pricing?feature=Konsignation#konsignation-addon"
      />
    );
  }
  const { db } = context;

  const [inventoryPositions, legacyItems] = await Promise.all([
    db.inventoryPosition.findMany({
      where: {
        inventoryType: "CONSIGNMENT",
        ...(q
          ? {
              OR: [
                { inventoryNumber: { contains: q, mode: "insensitive" as const } },
                { product: { name: { contains: q, mode: "insensitive" as const } } },
                { product: { ean: { contains: q } } },
                {
                  consignmentLot: {
                    is: { partnerCompany: { contains: q, mode: "insensitive" as const } },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        product: true,
        consignmentLot: true,
      },
      orderBy: { receivedAt: "desc" },
      take: 200,
    }),
    db.consignmentInventory.findMany({
      where: q
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { consignorName: { contains: q, mode: "insensitive" } },
              { itemTitle: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
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
  const consignmentLotIds = inventoryPositions
    .map((position) => position.consignmentLot?.id)
    .filter((id): id is string => Boolean(id));
  const sourceReferences = consignmentLotIds.length
    ? await db.sourceReference.findMany({
        where: {
          targetEntity: "CONSIGNMENT_LOT",
          targetEntityId: { in: consignmentLotIds },
        },
        select: { targetEntityId: true, warnings: true },
      })
    : [];
  const csvInfoByLotId = new Map(
    sourceReferences.map((reference) => [
      reference.targetEntityId,
      reference.warnings.filter((warning) => warning.startsWith("CSV: ")),
    ])
  );

  const inventoryRows = inventoryPositions
    .filter((position) => position.consignmentLot)
    .map((position) => {
      const lot = position.consignmentLot!;
      const commentInfo = splitLegacyComment(lot.comment);
      return {
        source: "inventory" as const,
        id: position.id,
        sku: position.inventoryNumber,
        partner: lot.partnerCompany,
        title: position.product.name,
        subtitle: [lot.externalSku ?? position.product.variant, position.product.ean]
          .filter(Boolean)
          .join(" · "),
        brand: position.product.brand,
        modelCode: lot.externalSku ?? position.product.variant,
        extraInfo: commentInfo.comment,
        csvInfo: [...(csvInfoByLotId.get(lot.id) ?? []), ...commentInfo.csvInfo],
        category: position.product.category,
        ean: position.product.ean,
        identificationNumber: lot.identificationNumber,
        quantity: position.quantityAvailable,
        quantityReceived: position.quantityReceived,
        soldQuantity: position.quantitySold,
        returnedQuantity: position.quantityInspection,
        defectiveQuantity: position.quantityDefective,
        costGrossCents: decimalToCents(lot.costGross),
        costNetCents: decimalToCents(lot.costNet),
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
      brand: null,
      modelCode: item.sku,
      extraInfo: item.consignorContact,
      csvInfo: [] as string[],
      category: null,
      ean: null,
      identificationNumber: null,
      quantity: item.quantity,
      quantityReceived:
        item.quantity + item.soldQuantity + item.returnedQuantity + item.defectiveQuantity,
      soldQuantity: item.soldQuantity,
      returnedQuantity: item.returnedQuantity,
      defectiveQuantity: item.defectiveQuantity,
      costGrossCents: item.agreedPayoutCents,
      costNetCents: null,
      linkedSaleIds: item.linkedSaleIds,
      linkedCount: linked.length,
      revenueCents: linked.reduce((sum, sale) => sum + sale.salePriceCents, 0),
      profitCents: linked.reduce((sum, sale) => sum + sale.profitCents, 0),
      status: "Legacy",
    };
  });

  const rows = [...inventoryRows, ...legacyRows];
  const visibleRowCount = rows.filter((row) => {
    if (requestedView === "stock") {
      return row.quantity > 0 || row.returnedQuantity > 0 || row.defectiveQuantity > 0;
    }
    if (requestedView === "sales") return row.soldQuantity > 0;
    if (requestedView === "payout") return row.soldQuantity > 0 || row.linkedCount > 0;
    return true;
  }).length;

  function ConsignmentDetailDrawer({ row }: { row: (typeof rows)[number] }) {
    return (
      <DetailDrawer title={row.sku} description={`${row.partner} · ${row.title}`}>
        <DetailSection title="Artikel">
          <DetailGrid
            items={[
              { label: "Partner", value: row.partner },
              { label: "Marke", value: row.brand ?? "-" },
              { label: "Artikel", value: row.title },
              { label: "Bezeichnung/SKU", value: row.modelCode || "-" },
              { label: "Zusatzinfo", value: row.extraInfo || "-" },
              {
                label: "Historische CSV-Info",
                value: row.csvInfo.length
                  ? row.csvInfo.map((info) => info.replace(/^CSV: /, "")).join(" · ")
                  : "-",
              },
              { label: "Kategorie", value: row.category || "-" },
              { label: "Identifikation", value: row.identificationNumber || "-" },
              { label: "Quelle", value: row.source === "legacy" ? "Legacy" : "InventoryPosition" },
            ]}
          />
        </DetailSection>
        <DetailSection title="Bestand">
          <DetailGrid
            items={[
              { label: "Verfuegbar", value: row.quantity },
              { label: "Erhalten", value: row.quantityReceived },
              { label: "Verkauft", value: row.soldQuantity },
              { label: "Pruefung", value: row.returnedQuantity },
              { label: "Defekt", value: row.defectiveQuantity },
              { label: "Status", value: row.status },
            ]}
          />
        </DetailSection>
        <DetailSection title="Finanzen">
          <DetailGrid
            items={[
              { label: "EK brutto", value: row.costGrossCents != null ? formatEuro(row.costGrossCents) : "-" },
              { label: "EK netto", value: row.costNetCents != null ? formatEuro(row.costNetCents) : "-" },
              { label: "Verknuepfte Verkaeufe", value: row.linkedCount },
            ]}
          />
        </DetailSection>
      </DetailDrawer>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Betrieb · Add-on"
        title="Konsignation"
        description="Fremdbestand mit K-Nummer, InventoryPosition, ConsignmentLot und vollständiger Movement-Historie."
        actions={
          <>
            <ImportExportBar table="konsignation" />
            <CreateConsignmentDialog />
          </>
        }
      />
      <OperationalSearchToolbar
        basePath="/konsignation"
        query={q ?? ""}
        placeholder="K-Nummer, Partner, Artikel oder EAN"
        hiddenParams={{ preset: requestedView === "standard" ? undefined : requestedView }}
      />

      <CompactTableShell
        definition={OPERATIONAL_MODULES.consignment}
        scope={{ organizationId: context.organization.id, userId: context.userId }}
        requestedView={requestedView}
        currentQuery={operationalSearchParams({
          preset: requestedView === "standard" ? undefined : requestedView,
          q,
        })}
        totalResults={visibleRowCount}
      >
        <Card className="rounded-none border-0 shadow-none">
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="sx-datatable">
                <TableHeader>
                  <TableRow>
                    <TableHead data-column data-column-key="number" data-view-standard data-view-partner data-view-stock data-view-sales data-view-payout data-view-all>K-Nummer</TableHead>
                    <TableHead data-column data-column-key="partner" data-view-standard data-view-partner data-view-payout data-view-all>Partner</TableHead>
                    <TableHead data-column data-column-key="product" data-view-standard data-view-partner data-view-stock data-view-sales data-view-payout data-view-all>Artikel</TableHead>
                    <TableHead data-column data-column-key="available" data-view-standard data-view-stock data-view-all className="text-right">Bestand</TableHead>
                    <TableHead data-column data-column-key="sold" data-view-standard data-view-sales data-view-payout data-view-all className="text-right">Verkauft</TableHead>
                    <TableHead data-column data-column-key="inspection" data-view-stock data-view-all className="text-right">Prüfung</TableHead>
                    <TableHead data-column data-column-key="defective" data-view-stock data-view-all className="text-right">Defekt</TableHead>
                    <TableHead data-column data-column-key="cost" data-view-standard data-view-partner data-view-payout data-view-all>EK / Auszahlung</TableHead>
                    <TableHead data-column data-column-key="status" data-view-standard data-view-stock data-view-sales data-view-payout data-view-all>Status</TableHead>
                    <TableHead data-column data-column-key="actions" data-view-standard data-view-partner data-view-stock data-view-sales data-view-payout data-view-all className="w-48 text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                        Noch keine Konsignationsware erfasst. Neue Ware wird als
                        K-Position im gemeinsamen Inventory gefuehrt.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row) => (
                    <TableRow
                      key={`${row.source}:${row.id}`}
                      data-table-view-row
                      data-row-view-standard
                      data-row-view-partner
                      data-row-view-stock={(row.quantity > 0 || row.returnedQuantity > 0 || row.defectiveQuantity > 0) || undefined}
                      data-row-view-sales={row.soldQuantity > 0 || undefined}
                      data-row-view-payout={(row.soldQuantity > 0 || row.linkedCount > 0) || undefined}
                      data-row-view-all
                    >
                      <TableCell data-column data-column-key="number" data-view-standard data-view-partner data-view-stock data-view-sales data-view-payout data-view-all className="font-mono text-xs">
                        <div>{row.sku}</div>
                        {row.source === "legacy" && (
                          <span className="text-[10px] uppercase text-muted-foreground">
                            Legacy
                          </span>
                        )}
                      </TableCell>
                      <TableCell data-column data-column-key="partner" data-view-standard data-view-partner data-view-payout data-view-all>{row.partner}</TableCell>
                      <TableCell data-column data-column-key="product" data-view-standard data-view-partner data-view-stock data-view-sales data-view-payout data-view-all className="sx-cell-primary max-w-64">
                        <div className="truncate font-medium">{row.title}</div>
                        {row.subtitle && (
                          <div className="truncate text-xs text-muted-foreground">
                            {row.subtitle}
                          </div>
                        )}
                      </TableCell>
                      <TableCell data-column data-column-key="available" data-view-standard data-view-stock data-view-all className="text-right">
                        {row.quantity} / {row.quantityReceived}
                      </TableCell>
                      <TableCell data-column data-column-key="sold" data-view-standard data-view-sales data-view-payout data-view-all className="text-right">{row.soldQuantity}</TableCell>
                      <TableCell data-column data-column-key="inspection" data-view-stock data-view-all className="text-right">{row.returnedQuantity}</TableCell>
                      <TableCell data-column data-column-key="defective" data-view-stock data-view-all className="text-right">{row.defectiveQuantity}</TableCell>
                      <TableCell data-column data-column-key="cost" data-view-standard data-view-partner data-view-payout data-view-all className="text-xs">
                        {row.costNetCents != null || row.costGrossCents != null ? (
                          <>
                            {row.costNetCents != null && (
                              <div>Netto {formatEuro(row.costNetCents)}</div>
                            )}
                            {row.costGrossCents != null && (
                              <div className="text-muted-foreground">
                                Brutto {formatEuro(row.costGrossCents)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell data-column data-column-key="status" data-view-standard data-view-stock data-view-sales data-view-payout data-view-all>
                        <Badge variant={row.source === "legacy" ? "secondary" : "outline"}>
                          {row.status}
                        </Badge>
                        {row.linkedCount > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatEuro(row.revenueCents)} · Marge {formatEuro(row.profitCents)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell data-column data-column-key="actions" data-view-standard data-view-partner data-view-stock data-view-sales data-view-payout data-view-all>
                        <div className="flex justify-end gap-1">
                          <ConsignmentDetailDrawer row={row} />
                          <ConsignmentRowActions
                            item={{
                              id: row.id,
                              sku: row.sku,
                              source: row.source,
                              inventoryPositionId: row.source === "inventory" ? row.id : undefined,
                              partner: row.partner,
                              title: row.title,
                              brand: row.brand,
                              modelCode: row.modelCode,
                              extraInfo: row.extraInfo,
                              category: row.category,
                              ean: row.ean,
                              identificationNumber: row.identificationNumber,
                              costGrossCents: row.costGrossCents,
                              costNetCents: row.costNetCents,
                              quantity: row.quantity,
                              soldQuantity: row.soldQuantity,
                              returnedQuantity: row.returnedQuantity,
                              defectiveQuantity: row.defectiveQuantity,
                              linkedSaleIds: row.linkedSaleIds,
                            }}
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

function splitLegacyComment(comment: string | null): { comment: string | null; csvInfo: string[] } {
  if (!comment) return { comment: null, csvInfo: [] };
  const parts = comment
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
  const csvPrefixes = ["MM Stk.:", "Lager:", "Historische Retoure:"];
  const csvInfo = parts
    .filter((part) => csvPrefixes.some((prefix) => part.startsWith(prefix)))
    .map((part) => `CSV: ${part}`);
  const editableComment = parts
    .filter((part) => !csvPrefixes.some((prefix) => part.startsWith(prefix)))
    .join(" · ");

  return { comment: editableComment || null, csvInfo };
}

function decimalToCents(value: unknown): number | null {
  if (value == null) return null;
  return Math.round(Number(value) * 100);
}
