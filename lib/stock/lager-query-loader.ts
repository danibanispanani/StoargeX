import { EntryStatus, StockItemStatus } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
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
        include: {
          product: true,
          ownedLot: true,
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
        include: { listings: { select: { platformId: true } } },
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

  return {
    ownedPositions,
    items,
    platforms,
    zmOptions: stockOptions.PAYMENT_METHOD,
    storageLocations: stockOptions.STORAGE_LOCATION,
    lowAlerts,
  };
}
