import { requireOrg } from "@/lib/org";
import { getOptions } from "@/lib/options";
import { loadLowStockAlerts, lowStockKey } from "@/lib/reporting";
import { EntryStatus, StockItemStatus } from "@prisma/client";
import { StockItemDialog } from "@/components/stock/stock-item-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { StockFilterBar } from "@/components/stock/stock-filter-bar";
import { StockTable, type StockRow } from "@/components/stock/stock-table";
import { deriveOwnedStockStatus } from "@/lib/services/owned-purchase-service";

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
  }>;
}) {
  const { db, organization } = await requireOrg();
  const params = await searchParams;

  const statusFilter =
    params.status && params.status in StockItemStatus
      ? (params.status as StockItemStatus)
      : undefined;
  const kaufFilter =
    params.kauf && params.kauf in EntryStatus ? (params.kauf as EntryStatus) : undefined;
  const retoureFilter =
    params.retoure && params.retoure in EntryStatus
      ? (params.retoure as EntryStatus)
      : undefined;
  const ownedLotWhere = {
    ...(kaufFilter ? { purchaseEntryStatus: kaufFilter } : {}),
    ...(retoureFilter ? { returnEntryStatus: retoureFilter } : {}),
    ...(params.zm ? { paymentMethod: params.zm } : {}),
  };

  const [ownedPositions, items, platforms, zmOptions, products, lowAlerts] = await Promise.all([
    db.inventoryPosition.findMany({
      where: {
        inventoryType: "OWNED",
        ...(params.plattform
          ? { listings: { some: { platformId: params.plattform } } }
          : {}),
        ...(params.von || params.bis
          ? {
              receivedAt: {
                ...(params.von ? { gte: new Date(params.von) } : {}),
                ...(params.bis ? { lte: new Date(`${params.bis}T23:59:59`) } : {}),
              },
            }
          : {}),
        ...(params.q
          ? {
              OR: [
                { inventoryNumber: { contains: params.q, mode: "insensitive" } },
                { product: { name: { contains: params.q, mode: "insensitive" } } },
                { product: { variant: { contains: params.q, mode: "insensitive" } } },
                { product: { ean: { contains: params.q } } },
                { ownedLot: { is: { vendor: { contains: params.q, mode: "insensitive" } } } },
                { ownedLot: { is: { ean: { contains: params.q } } } },
              ],
            }
          : {}),
        ...(Object.keys(ownedLotWhere).length > 0
          ? { ownedLot: { is: ownedLotWhere } }
          : {}),
      },
      include: {
        product: true,
        ownedLot: true,
        listings: { select: { platformId: true } },
      },
      orderBy: { inventoryNumber: "desc" },
      take: 500,
    }),
    db.stockItem.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(kaufFilter ? { kaufStatus: kaufFilter } : {}),
        ...(retoureFilter ? { retoureStatus: retoureFilter } : {}),
        ...(params.zm ? { paymentMethod: params.zm } : {}),
        ...(params.plattform
          ? { listings: { some: { platformId: params.plattform } } }
          : {}),
        ...(params.von || params.bis
          ? {
              purchaseDate: {
                ...(params.von ? { gte: new Date(params.von) } : {}),
                ...(params.bis ? { lte: new Date(`${params.bis}T23:59:59`) } : {}),
              },
            }
          : {}),
        ...(params.q
          ? {
              OR: [
                { title: { contains: params.q, mode: "insensitive" } },
                { variant: { contains: params.q, mode: "insensitive" } },
                { sku: { contains: params.q, mode: "insensitive" } },
                { ean: { contains: params.q } },
                { supplier: { contains: params.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { listings: { select: { platformId: true } } },
      orderBy: { sku: "desc" },
      take: 500,
    }),
    db.platform.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getOptions(db, organization.id, "PAYMENT_METHOD"),
    db.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        variant: true,
        size: true,
        ean: true,
        category: true,
        defaultPriceCents: true,
      },
      take: 500,
    }),
    loadLowStockAlerts(db, organization.lowStockThreshold),
  ]);

  const lowKeys = new Set(lowAlerts.map((a) => a.key));

  const ownedRows: StockRow[] = ownedPositions
    .filter((position) => position.ownedLot)
    .map((position) => {
      const lot = position.ownedLot!;
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
        imageUrl: lot.imageUrls[0] ?? position.product.imageUrls[0] ?? null,
        listings: position.listings.map((l) => l.platformId),
        notes: "",
        low:
          position.quantityReceived > 1 &&
          position.quantityAvailable <= organization.lowStockThreshold,
        availableQuantity: position.quantityAvailable,
        originalQuantity: position.quantityReceived,
      };
    });

  const legacyRows: StockRow[] = items.map((item) => ({
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
    listings: item.listings.map((l) => l.platformId),
    notes: item.notes ?? "",
    low: lowKeys.has(lowStockKey(item.title, item.variant)),
    availableQuantity: item.quantity,
    originalQuantity: 1,
  }));

  const rows = [...ownedRows, ...legacyRows];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Lager</h1>
          <p className="text-sm text-muted-foreground">
            {ownedRows.length} Charge(n), {legacyRows.length} Legacy-Einheit(en){" "}
            {Object.values(params).some(Boolean) ? "(gefiltert)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ImportExportBar table="lager" />
          <StockItemDialog
            platforms={platforms}
            zmOptions={zmOptions}
            products={products}
          />
        </div>
      </div>

      <StockFilterBar
        filters={{
          q: params.q ?? "",
          status: params.status ?? "",
          kauf: params.kauf ?? "",
          retoure: params.retoure ?? "",
          zm: params.zm ?? "",
          plattform: params.plattform ?? "",
          von: params.von ?? "",
          bis: params.bis ?? "",
        }}
        platforms={platforms}
        zmOptions={zmOptions}
      />

      <StockTable
        rows={rows}
        platforms={platforms}
        zmOptions={zmOptions}
        products={products}
      />
    </div>
  );
}

function decimalToCents(value: { toString(): string }): number {
  return Math.round(Number(value.toString()) * 100);
}
