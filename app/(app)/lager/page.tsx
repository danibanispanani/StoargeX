import { requireOrg } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { lowStockKey } from "@/lib/reporting";
import { LazyStockItemDialog } from "@/components/stock/lazy-stock-item-dialog";
import { StockFilterBar } from "@/components/stock/stock-filter-bar";
import { StockTable, type StockRow } from "@/components/stock/stock-table";
import { deriveOwnedStockStatus } from "@/lib/services/owned-purchase-service";
import { matchesLowStockFilter, parseStockView } from "@/lib/stock/stock-views";
import {
  parseStockTableQuery,
  sortStockRows,
} from "@/lib/stock/stock-table";
import {
  operationalSearchParams,
  parseOperationalSearchQuery,
} from "@/lib/operational-modules";
import { createLagerPerformanceTrace } from "@/lib/stock/lager-performance";
import { loadLagerInitialQueries } from "@/lib/stock/lager-query-loader";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    kauf?: string;
    retoure?: string;
    zm?: string;
    plattform?: string;
    von?: string;
    bis?: string;
    view?: string;
    alter?: string;
    bestand?: string;
    sort?: string;
    direction?: string;
  }>;
}) {
  const trace = await createLagerPerformanceTrace("GET /lager loader");
  const { db, organization, userId } = await requireOrg("READONLY", trace);
  const rawParams = await searchParams;
  const normalizedQuery = parseOperationalSearchQuery(rawParams.q);
  const params = { ...rawParams, q: normalizedQuery || undefined };
  const view = parseStockView(params.view);
  const tableQuery = parseStockTableQuery(params);

  const { ownedPositions, imageThumbnailsByPositionId, items, platforms, zmOptions, storageLocations, lowAlerts } =
    await loadLagerInitialQueries({
      db,
      organizationId: organization.id,
      lowStockThreshold: organization.lowStockThreshold,
      params,
      view,
      trace,
    });

  const lowKeys = trace.measureSync(
    "transform.low_stock_keys",
    () => new Set(lowAlerts.map((a) => a.key))
  );

  const ownedRows: StockRow[] = trace.measureSync("transform.inventory_positions", () =>
    ownedPositions.filter((position) => position.ownedLot).map((position) => {
      const lot = position.ownedLot!;
      const imageUrl = imageThumbnailsByPositionId[position.id] ?? null;
      return {
        source: "owned",
        id: position.id,
        lotId: lot.id,
        sku: position.inventoryNumber,
        date: lot.purchaseDate.toLocaleDateString("de-DE"),
        dateIso: lot.purchaseDate.toISOString().slice(0, 10),
        supplier: lot.vendor,
        title: position.product.name,
        variant: position.product.variant ?? "",
        size: position.product.size ?? "",
        grossCents: decimalToCents(lot.unitPriceGross),
        netCents: decimalToCents(lot.unitPriceNet),
        inputTaxDeductible: lot.vatDeductible,
        zm: lot.paymentMethod,
        kaufStatus: lot.purchaseEntryStatus,
        retoureStatus: lot.returnEntryStatus,
        status: "IN_STOCK",
        derivedStatus: deriveOwnedStockStatus(position),
        ean: lot.ean ?? position.product.ean ?? "",
        imageUrl,
        imageUrls: imageUrl ? [imageUrl] : [],
        itemCondition: position.itemCondition,
        location: position.location,
        listings: position.listings.map((l) => l.platformId),
        notes: position.notes ?? "",
        low: lowKeys.has(lowStockKey(position.product.name, position.product.variant)),
        availableQuantity: position.quantityAvailable,
        originalQuantity: position.quantityReceived,
        returnableQuantity: 0,
        purchaseNumber: null,
        receiptId: null,
        receiptCancelled: false,
        receiptLineCount: 0,
        cancellableQuantity: 0,
      };
    })
  );

  const legacyRows: StockRow[] = trace.measureSync("transform.legacy_stock_items", () =>
    items.map((item) => ({
    source: "legacy",
    id: item.id,
    sku: item.sku,
    date: item.purchaseDate?.toLocaleDateString("de-DE") ?? "–",
    dateIso: item.purchaseDate?.toISOString().slice(0, 10) ?? "",
    supplier: item.supplier ?? "",
    title: item.title,
    variant: item.variant ?? "",
    size: item.size ?? "",
    grossCents: item.purchasePriceCents,
    netCents: item.purchaseNetCents,
    inputTaxDeductible: item.inputTaxDeductible,
    zm: item.paymentMethod ?? "",
    kaufStatus: item.kaufStatus,
    retoureStatus: item.retoureStatus,
    status: item.status,
    ean: item.ean ?? "",
    imageUrl: item.imageUrls[0] ?? null,
    imageUrls: item.imageUrls,
    itemCondition: item.itemCondition,
    location: item.location,
    listings: item.listings.map((l) => l.platformId),
    notes: item.notes ?? "",
    low: lowKeys.has(lowStockKey(item.title, item.variant)),
    availableQuantity: item.quantity,
    originalQuantity: 1,
    returnableQuantity: 0,
    purchaseNumber: null,
    receiptId: null,
    receiptCancelled: false,
    receiptLineCount: 0,
    cancellableQuantity: 0,
    }))
  );

  const allRows = trace.measureSync("transform.merge_rows", () => [...ownedRows, ...legacyRows]);
  const filteredRows = trace.measureSync("filter.rows", () =>
    params.bestand === "niedrig" ? allRows.filter(matchesLowStockFilter) : allRows
  );
  const rows = trace.measureSync("sort.rows", () => sortStockRows(filteredRows, tableQuery));

  trace.finish({
    inventoryPositionCount: ownedPositions.length,
    legacyStockItemCount: items.length,
    rowCount: rows.length,
    platformCount: platforms.length,
    paymentMethodCount: zmOptions.length,
    storageLocationCount: storageLocations.length,
    lowStockAlertCount: lowAlerts.length,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Handel"
        title="Lager"
        description="Bestände, Lagerpositionen und Warenbewegungen zentral nachvollziehen."
        actions={<LazyStockItemDialog platforms={platforms} zmOptions={zmOptions} storageLocations={storageLocations} />}
      />

      <StockFilterBar
        filters={{
          q: params.q ?? "",
          von: params.von ?? "",
          bis: params.bis ?? "",
        }}
        activeView={view}
        tableQuery={tableQuery}
      />

      <StockTable
        rows={rows}
        platforms={platforms}
        storageLocations={storageLocations}
        scope={{ organizationId: organization.id, userId }}
        tableQuery={tableQuery}
        currentQuery={operationalSearchParams({
          ...params,
          view: view === "standard" ? undefined : view,
        })}
      />
    </div>
  );
}

function decimalToCents(value: { toString(): string }): number {
  return Math.round(Number(value.toString()) * 100);
}
