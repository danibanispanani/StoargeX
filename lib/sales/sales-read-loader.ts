import type { Prisma, SaleStatus } from "@prisma/client";
import { getOptions } from "@/lib/options";
import type { TablePageSize } from "@/lib/operational-table";
import type { TenantDb } from "@/lib/tenant-db";
import {
  buildSaleViewWhere,
  parseSalePagination,
} from "@/lib/sales/sale-table";

interface SalesReadTrace {
  measureDb<T>(name: string, task: () => Promise<T>, queryCount?: number): Promise<T>;
}

export interface SalesReadParams {
  q?: string;
  status?: string;
  rechnung?: string;
  buchung?: string;
  porto?: string;
  platform?: string;
  versandart?: string;
  von?: string;
  bis?: string;
  page?: string;
  pageSize?: string;
}

export interface SalesReadRow {
  sale: {
    id: string;
    orderNumber: string | null;
    soldAt: Date;
    quantity: number;
    salePriceCents: number;
    saleNetCents: number;
    platformFeeCents: number;
    platformFeeNetCents: number;
    shippingCostCents: number;
    profitCents: number;
    marginCents: number;
    buyerCountry: string;
    shippingMethod: string | null;
    payoutRecipient: string | null;
    status: SaleStatus;
    invoiceCreated: boolean;
    historicalRelationStatus: string;
    notes: string | null;
    platformId: string;
    marketplaceAccountId: string | null;
    feeInclVat: boolean;
    platform: { name: string };
    debtLinks: Array<{ debt: { debtNumber: string | null; status: string } }>;
    saleLines: Array<{
      id?: string;
      descriptionSnapshot: string;
      variantSnapshot: string | null;
      sizeSnapshot: string | null;
      quantity: number;
      allocations: Array<{
        quantity: number;
        unitCostNetSnapshot: unknown;
        inventoryPosition: { inventoryNumber: string };
      }>;
    }>;
  };
  itemInfos: Array<{
    sku: string;
    model: string;
    variant: string;
    size: string;
    quantity: number;
  }>;
  ekNetCents: number;
  hasNewLines: boolean;
}

export interface SalesInitialReadResult {
  rows: SalesReadRow[];
  platforms: Array<{ id: string; name: string }>;
  shippingMethodOptions: string[];
  totalResults: number;
  page: number;
  pageSize: TablePageSize;
  rowCounts: {
    sales: number;
    platforms: number;
    shippingMethods: number;
  };
}

const saleListSelect = {
  id: true,
  orderNumber: true,
  soldAt: true,
  quantity: true,
  salePriceCents: true,
  saleNetCents: true,
  platformFeeCents: true,
  platformFeeNetCents: true,
  shippingCostCents: true,
  profitCents: true,
  marginCents: true,
  buyerCountry: true,
  shippingMethod: true,
  payoutRecipient: true,
  status: true,
  invoiceCreated: true,
  historicalRelationStatus: true,
  notes: true,
  platformId: true,
  marketplaceAccountId: true,
  feeInclVat: true,
  platform: { select: { name: true } },
  debtLinks: {
    select: {
      debt: { select: { debtNumber: true, status: true } },
    },
  },
  saleLines: {
    select: {
      id: true,
      descriptionSnapshot: true,
      variantSnapshot: true,
      sizeSnapshot: true,
      quantity: true,
    },
  },
  items: {
    select: {
      ekNetCents: true,
      stockItem: {
        select: { sku: true, title: true, variant: true, size: true },
      },
      consignment: { select: { sku: true, itemTitle: true } },
    },
  },
} satisfies Prisma.SaleSelect;

type SaleListRecord = Prisma.SaleGetPayload<{ select: typeof saleListSelect }>;

type SaleAllocationSummary = {
  saleLineId: string;
  quantity: number;
  unitCostNetSnapshot: unknown;
  inventoryPosition: { inventoryNumber: string };
};

export async function loadSalesInitialRead(input: {
  db: TenantDb;
  organizationId: string;
  params: SalesReadParams;
  view: string;
  trace?: SalesReadTrace;
}): Promise<SalesInitialReadResult> {
  const { db, params, view, trace } = input;
  const measureDb = <T>(name: string, task: () => Promise<T>, queryCount = 2) =>
    trace ? trace.measureDb(name, task, queryCount) : task();
  const { page: requestedPage, pageSize } = parseSalePagination(params);
  const where = buildSalesWhere(params, view);

  const optionsPromise = Promise.all([
    measureDb("sales.options.platforms", () =>
      db.platform.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    ),
    measureDb("sales.options.shipping_methods", () =>
      db.shippingRate.findMany({
        where: { active: true },
        orderBy: [{ carrierName: "asc" }, { name: "asc" }],
        select: { carrierName: true, name: true },
      })
    ),
  ]);

  const totalResults = await measureDb("sales.count", () =>
    db.sale.count({ where })
  );
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const [sales, [platforms, shippingRates]] = await Promise.all([
    measureDb("sales.list.slim", () =>
      db.sale.findMany({
        where,
        select: saleListSelect,
        orderBy: { soldAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
    ),
    optionsPromise,
  ]);
  const lineIds = sales.flatMap((sale) => sale.saleLines.map((line) => line.id));
  const saleAllocations = lineIds.length
    ? await measureDb(
        "sales.line_allocations.summary",
        () =>
          db.saleLineAllocation.findMany({
            where: { saleLineId: { in: lineIds } },
            select: {
              saleLineId: true,
              quantity: true,
              unitCostNetSnapshot: true,
              inventoryPosition: {
                select: { inventoryNumber: true },
              },
            },
            orderBy: { createdAt: "asc" },
          }),
        2
      )
    : [];
  const allocationsByLine = groupSaleAllocationsByLine(saleAllocations);

  const shippingMethodOptions = [
    ...new Set([
      ...shippingRates.map((rate) => `${rate.carrierName} ${rate.name}`),
      "Abholung",
      "Vinted",
      "Sonstiges",
    ]),
  ];

  return {
    rows: sales.map((sale) => toSalesReadRow(sale, allocationsByLine)),
    platforms,
    shippingMethodOptions,
    totalResults,
    page,
    pageSize,
    rowCounts: {
      sales: sales.length,
      platforms: platforms.length,
      shippingMethods: shippingMethodOptions.length,
    },
  };
}

export async function loadSaleDialogOptions(input: {
  db: TenantDb;
  organizationId: string;
  trace?: SalesReadTrace;
}) {
  const { db, organizationId, trace } = input;
  const measureDb = <T>(name: string, task: () => Promise<T>, queryCount = 2) =>
    trace ? trace.measureDb(name, task, queryCount) : task();
  const [platforms, payoutOptions, shippingRates, marketplaceAccounts] =
    await Promise.all([
      measureDb("sales.dialog.platforms", () =>
        db.platform.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      ),
      measureDb("sales.dialog.payout_options", () =>
        getOptions(db, organizationId, "PAYOUT_RECIPIENT")
      ),
      measureDb("sales.dialog.shipping_rates", () =>
        db.shippingRate.findMany({
          where: { active: true },
          orderBy: [{ carrierName: "asc" }, { name: "asc" }],
          select: {
            id: true,
            carrierName: true,
            name: true,
            countries: true,
            baseCents: true,
          },
        })
      ),
      measureDb("sales.dialog.marketplace_accounts", () =>
        db.marketplaceAccount.findMany({
          where: { active: true },
          include: { defaultFeeSchedule: true },
          orderBy: { displayName: "asc" },
        })
      ),
    ]);

  return {
    platforms,
    payoutOptions,
    shippingRates,
    marketplaceAccountOptions: marketplaceAccounts.map((account) => ({
      id: account.id,
      platformId: account.platformId,
      displayName: account.displayName,
      catalogVersion: account.defaultFeeSchedule?.version ?? null,
    })),
  };
}

export function buildSalesWhere(
  params: SalesReadParams,
  view: string
): Prisma.SaleWhereInput {
  const filterWhere: Prisma.SaleWhereInput = {
    ...(params.status === "PENDING"
      ? { status: { in: ["PENDING", "PAID", "SHIPPED"] } }
      : params.status === "COMPLETED"
        ? { status: "COMPLETED" as const }
        : {}),
    ...(params.rechnung === "offen"
      ? { invoiceCreated: false }
      : params.rechnung === "erledigt"
        ? { invoiceCreated: true }
        : {}),
    ...(params.buchung === "fehlt"
      ? {
          status: { not: "CANCELLED" },
          AND: [{ OR: [{ invoiceCreated: false }, { feesBooked: false }] }],
        }
      : {}),
    ...(params.porto === "offen"
      ? {
          status: { in: ["PAID", "SHIPPED"] },
          postageBooked: false,
        }
      : {}),
    ...(params.platform ? { platformId: params.platform } : {}),
    ...(params.versandart ? { shippingMethod: params.versandart } : {}),
    ...(params.von || params.bis
      ? {
          soldAt: {
            ...(params.von ? { gte: new Date(params.von) } : {}),
            ...(params.bis ? { lte: new Date(`${params.bis}T23:59:59`) } : {}),
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { orderNumber: { contains: params.q, mode: "insensitive" as const } },
            { notes: { contains: params.q, mode: "insensitive" as const } },
            {
              saleLines: {
                some: {
                  OR: [
                    {
                      descriptionSnapshot: {
                        contains: params.q,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      allocations: {
                        some: {
                          inventoryPosition: {
                            inventoryNumber: {
                              contains: params.q,
                              mode: "insensitive" as const,
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
            {
              items: {
                some: {
                  stockItem: {
                    OR: [
                      { title: { contains: params.q, mode: "insensitive" as const } },
                      { sku: { contains: params.q, mode: "insensitive" as const } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  return { AND: [filterWhere, buildSaleViewWhere(view)] };
}

function groupSaleAllocationsByLine(rows: SaleAllocationSummary[]) {
  const grouped = new Map<string, SaleAllocationSummary[]>();
  for (const row of rows) {
    const current = grouped.get(row.saleLineId);
    if (current) current.push(row);
    else grouped.set(row.saleLineId, [row]);
  }
  return grouped;
}

function toSalesReadRow(
  sale: SaleListRecord,
  allocationsByLine: Map<string, SaleAllocationSummary[]>
): SalesReadRow {
  const hasNewLines = sale.saleLines.length > 0;
  const saleLines = sale.saleLines.map((line) => ({
    descriptionSnapshot: line.descriptionSnapshot,
    variantSnapshot: line.variantSnapshot,
    sizeSnapshot: line.sizeSnapshot,
    quantity: line.quantity,
    allocations: (allocationsByLine.get(line.id) ?? []).map((allocation) => ({
      quantity: allocation.quantity,
      unitCostNetSnapshot: allocation.unitCostNetSnapshot,
      inventoryPosition: allocation.inventoryPosition,
    })),
  }));
  const itemInfos = hasNewLines
    ? saleLines.map((line) => ({
        sku: line.allocations
          .map((allocation) => allocation.inventoryPosition.inventoryNumber)
          .join(", "),
        model: line.descriptionSnapshot,
        variant: line.variantSnapshot ?? "",
        size: line.sizeSnapshot ?? "",
        quantity: line.quantity,
      }))
    : sale.items.map((item) =>
        item.stockItem
          ? {
              sku: item.stockItem.sku,
              model: item.stockItem.title,
              variant: item.stockItem.variant ?? "",
              size: item.stockItem.size ?? "",
              quantity: 1,
            }
          : {
              sku: item.consignment?.sku ?? "?",
              model: item.consignment?.itemTitle ?? "?",
              variant: "",
              size: "",
              quantity: 1,
            }
      );
  const ekNetCents = hasNewLines
    ? saleLines.reduce(
        (sum, line) =>
          sum +
          line.allocations.reduce(
            (lineSum, allocation) =>
              lineSum +
              allocation.quantity *
                Math.round(Number(allocation.unitCostNetSnapshot) * 100),
            0
          ),
        0
      )
    : sale.items.reduce((sum, item) => sum + item.ekNetCents, 0);

  return {
    sale: { ...sale, saleLines },
    itemInfos,
    ekNetCents,
    hasNewLines,
  };
}
