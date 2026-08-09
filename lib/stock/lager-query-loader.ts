import { EntryStatus, Prisma, StockItemStatus } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { withTenantReadTransaction } from "@/lib/tenant-db";
import { getOptionsForKinds } from "@/lib/options";
import { loadLowStockAlerts } from "@/lib/reporting";
import type { StockView } from "@/lib/stock/stock-views";

interface LagerQueryTrace {
  measureDb<T>(name: string, task: () => Promise<T>, queryCount?: number): Promise<T>;
}

export interface LagerQueryParams {
  q?: string;
  status?: string;
  kauf?: string;
  retoure?: string;
  zm?: string;
  plattform?: string;
  von?: string;
  bis?: string;
  alter?: string;
}

type InventoryThumbnailRow = {
  positionId: string;
  imageUrl: string | null;
};

export async function loadLagerInitialQueries(input: {
  db: TenantDb;
  organizationId: string;
  lowStockThreshold: number;
  params: LagerQueryParams;
  view: StockView;
  trace?: LagerQueryTrace;
  seedMissingOptions?: boolean;
}) {
  const {
    db,
    organizationId,
    lowStockThreshold,
    params,
    view,
    trace,
    seedMissingOptions = true,
  } = input;
  const measureDb = <T>(name: string, task: () => Promise<T>, queryCount = 1) =>
    trace ? trace.measureDb(name, task, queryCount) : task();
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

  const [ownedPositions, items, platforms, stockOptions, lowAlerts] =
    await Promise.all([
      measureDb("query.inventory_positions", () => db.inventoryPosition.findMany({
        where: {
          inventoryType: "OWNED",
          quantityReceived: { gt: 0 },
          ...(view === "stock" ? { quantityAvailable: { gt: 0 } } : {}),
          ...(params.alter === "langsam"
            ? {
                quantityAvailable: { gt: 0 },
                receivedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
              }
            : {}),
          ...(view === "listings" ? { listings: { some: {} } } : {}),
          ...(view === "inspection"
            ? { OR: [{ quantityInspection: { gt: 0 } }, { quantityDefective: { gt: 0 } }] }
            : {}),
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
                  { inventoryNumber: { contains: params.q, mode: "insensitive" as const } },
                  { product: { name: { contains: params.q, mode: "insensitive" as const } } },
                  { product: { variant: { contains: params.q, mode: "insensitive" as const } } },
                  { product: { ean: { contains: params.q } } },
                  { ownedLot: { is: { vendor: { contains: params.q, mode: "insensitive" as const } } } },
                  { ownedLot: { is: { ean: { contains: params.q } } } },
                ],
              }
            : {}),
          ...(Object.keys(ownedLotWhere).length > 0
            ? { ownedLot: { is: ownedLotWhere } }
            : {}),
        },
        select: {
          id: true,
          inventoryNumber: true,
          itemCondition: true,
          location: true,
          notes: true,
          quantityReceived: true,
          quantityAvailable: true,
          quantityReserved: true,
          quantityInspection: true,
          quantityDefective: true,
          quantitySold: true,
          product: {
            select: {
              name: true,
              variant: true,
              size: true,
              ean: true,
            },
          },
          ownedLot: {
            select: {
              id: true,
              purchaseDate: true,
              vendor: true,
              unitPriceGross: true,
              unitPriceNet: true,
              vatDeductible: true,
              paymentMethod: true,
              purchaseEntryStatus: true,
              returnEntryStatus: true,
              ean: true,
            },
          },
          listings: { select: { platformId: true } },
        },
        orderBy: { inventoryNumber: "desc" },
        take: 500,
      })),
      measureDb("query.legacy_stock_items", () => db.stockItem.findMany({
        where: {
          ...(statusFilter ? { status: statusFilter } : { status: { not: "CANCELLED" as const } }),
          ...(view === "stock" ? { quantity: { gt: 0 } } : {}),
          ...(params.alter === "langsam"
            ? {
                quantity: { gt: 0 },
                purchaseDate: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
              }
            : {}),
          ...(view === "purchasing" ? { purchaseDate: { not: null } } : {}),
          ...(view === "listings" ? { listings: { some: {} } } : {}),
          ...(view === "inspection"
            ? { status: { in: ["RETURNED", "OTHER"] as StockItemStatus[] } }
            : {}),
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
                  { title: { contains: params.q, mode: "insensitive" as const } },
                  { variant: { contains: params.q, mode: "insensitive" as const } },
                  { sku: { contains: params.q, mode: "insensitive" as const } },
                  { ean: { contains: params.q } },
                  { supplier: { contains: params.q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          sku: true,
          purchaseDate: true,
          supplier: true,
          title: true,
          variant: true,
          size: true,
          purchasePriceCents: true,
          purchaseNetCents: true,
          inputTaxDeductible: true,
          paymentMethod: true,
          kaufStatus: true,
          retoureStatus: true,
          status: true,
          ean: true,
          imageUrls: true,
          itemCondition: true,
          location: true,
          notes: true,
          quantity: true,
          listings: { select: { platformId: true } },
        },
        orderBy: { sku: "desc" },
        take: 500,
      })),
      measureDb("query.platforms", () => db.platform.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })),
      measureDb("query.stock_options", () =>
        getOptionsForKinds(
          db,
          organizationId,
          ["PAYMENT_METHOD", "STORAGE_LOCATION"],
          { seedMissing: seedMissingOptions }
        )
      ),
      measureDb(
        "query.low_stock_alerts",
        () => loadLowStockAlerts(db, lowStockThreshold),
        2
      ),
    ]);
  const shouldLoadThumbnails = view === "listings" || view === "all";
  const thumbnailRows = ownedPositions.length && shouldLoadThumbnails
    ? await measureDb(
        "query.inventory_image_thumbnails",
        () =>
          loadInventoryImageThumbnails(
            organizationId,
            ownedPositions.map((position) => position.id)
          ),
        1
      )
    : [];

  return {
    ownedPositions,
    imageThumbnailsByPositionId: Object.fromEntries(
      thumbnailRows.map((row) => [row.positionId, row.imageUrl])
    ),
    items,
    platforms,
    zmOptions: stockOptions.PAYMENT_METHOD,
    storageLocations: stockOptions.STORAGE_LOCATION,
    lowAlerts,
  };
}

async function loadInventoryImageThumbnails(
  organizationId: string,
  positionIds: string[]
): Promise<InventoryThumbnailRow[]> {
  if (positionIds.length === 0) return [];
  return withTenantReadTransaction(organizationId, (tx) =>
    tx.$queryRaw<InventoryThumbnailRow[]>`
      SELECT
        position."id" AS "positionId",
        COALESCE(lot."image_urls"[1], product."image_urls"[1]) AS "imageUrl"
      FROM "inventory_positions" position
      JOIN "products" product ON product."id" = position."product_id"
      LEFT JOIN "owned_stock_lots" lot ON lot."inventory_position_id" = position."id"
      WHERE position."organization_id" = ${organizationId}
        AND position."id" IN (${Prisma.join(positionIds)})
    `
  );
}
