import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import {
  buildInsightSnapshot,
  resolveInsightPeriod,
  type InsightFilters,
  type InsightInventoryPosition,
  type InsightSourceData,
} from "@/lib/dashboard/insight-dashboard";
import { IMPORT_REVIEW_STATUSES } from "@/lib/imports/import-review";

export interface InsightFilterOption {
  value: string;
  label: string;
  parentValue?: string;
}

export interface InsightDashboardResult {
  filters: InsightFilters;
  period: ReturnType<typeof resolveInsightPeriod>;
  options: {
    platforms: InsightFilterOption[];
    marketplaceAccounts: InsightFilterOption[];
    categories: InsightFilterOption[];
    members: InsightFilterOption[];
  };
  snapshot: ReturnType<typeof buildInsightSnapshot>;
  dataBasis: {
    salesRows: number;
    inventoryRows: number;
    generatedAt: Date;
  };
}

const OPEN_CUSTOMER_RETURN_STATUSES = [
  "REQUESTED",
  "RECEIVED",
  "INSPECTION",
  "DEFECTIVE",
  "CONFLICT",
] as const;
const TERMINAL_SUPPLIER_RETURN_STATUSES = [
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;
const OPEN_SUPPLIER_REFUND_STATUSES = [
  "DISPATCHED",
  "ARRIVED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "CREDIT_PENDING",
] as const;

interface SaleLineScopeInput {
  label: string;
  grossAmountCents: number;
  quantity: number;
  category: string | null;
  allocations: Array<{
    inventoryType: "OWNED" | "CONSIGNMENT";
    quantity: number;
  }>;
}

export function calculateSaleScope(
  lines: SaleLineScopeInput[],
  filters: Pick<InsightFilters, "category" | "ownership">
) {
  if (!filters.category && filters.ownership === "ALL") {
    return {
      financialRatio: 1,
      productLabels: lines.map((line) => line.label).filter(Boolean),
    };
  }

  const useGrossWeight = lines.some((line) => line.grossAmountCents > 0);
  const lineWeight = (line: SaleLineScopeInput) =>
    useGrossWeight ? Math.max(0, line.grossAmountCents) : Math.max(0, line.quantity);
  const totalWeight = lines.reduce((total, line) => total + lineWeight(line), 0);
  let scopedWeight = 0;
  const productLabels: string[] = [];

  for (const line of lines) {
    if (filters.category && line.category !== filters.category) continue;
    let ownershipRatio = 1;
    if (filters.ownership !== "ALL") {
      const allocatedQuantity = line.allocations.reduce(
        (total, allocation) => total + allocation.quantity,
        0
      );
      const matchingQuantity = line.allocations.reduce(
        (total, allocation) =>
          total +
          (allocation.inventoryType === filters.ownership ? allocation.quantity : 0),
        0
      );
      ownershipRatio =
        allocatedQuantity > 0 ? matchingQuantity / allocatedQuantity : 0;
    }
    if (ownershipRatio <= 0) continue;
    scopedWeight += lineWeight(line) * ownershipRatio;
    if (line.label) productLabels.push(line.label);
  }

  return {
    financialRatio:
      totalWeight > 0 ? Math.min(1, Math.max(0, scopedWeight / totalWeight)) : 0,
    productLabels,
  };
}

function asCents(value: unknown) {
  return Math.round(Number(value ?? 0) * 100);
}

const saleLineScopeSelect = {
  descriptionSnapshot: true,
  grossAmount: true,
  quantity: true,
  product: { select: { category: true } },
  allocations: {
    select: { inventoryTypeSnapshot: true, quantity: true },
  },
} satisfies Prisma.SaleLineSelect;

function toSaleLineScope(
  lines: Array<{
    descriptionSnapshot: string;
    grossAmount: unknown;
    quantity: number;
    product: { category: string | null };
    allocations: Array<{
      inventoryTypeSnapshot: "OWNED" | "CONSIGNMENT";
      quantity: number;
    }>;
  }>
): SaleLineScopeInput[] {
  return lines.map((line) => ({
    label: line.descriptionSnapshot,
    grossAmountCents: asCents(line.grossAmount),
    quantity: line.quantity,
    category: line.product.category,
    allocations: line.allocations.map((allocation) => ({
      inventoryType: allocation.inventoryTypeSnapshot,
      quantity: allocation.quantity,
    })),
  }));
}

function baseSaleWhere(filters: InsightFilters): Prisma.SaleWhereInput {
  const lineScope: Prisma.SaleLineWhereInput = {
    ...(filters.category ? { product: { category: filters.category } } : {}),
    ...(filters.ownership !== "ALL"
      ? {
          allocations: {
            some: { inventoryTypeSnapshot: filters.ownership },
          },
        }
      : {}),
  };
  return {
    status: { not: "CANCELLED" },
    ...(filters.platformId ? { platformId: filters.platformId } : {}),
    ...(filters.marketplaceAccountId
      ? { marketplaceAccountId: filters.marketplaceAccountId }
      : {}),
    ...(Object.keys(lineScope).length > 0 ? { saleLines: { some: lineScope } } : {}),
  };
}

function taskMemberWhere(memberId: string): Prisma.TaskWhereInput {
  return memberId
    ? {
        OR: [
          { assigneeId: memberId },
          { assignments: { some: { userId: memberId } } },
        ],
      }
    : {};
}

function inventoryWhere(
  filters: InsightFilters,
  effectivePlatformId: string
): Prisma.InventoryPositionWhereInput {
  return {
    active: true,
    ...(filters.ownership !== "ALL" ? { inventoryType: filters.ownership } : {}),
    ...(filters.category ? { product: { category: filters.category } } : {}),
    ...(effectivePlatformId
      ? { listings: { some: { platformId: effectivePlatformId } } }
      : {}),
  };
}

export function buildInsightQueryScopes(
  filters: InsightFilters,
  effectivePlatformId = filters.platformId
) {
  return {
    sale: baseSaleWhere(filters),
    inventory: inventoryWhere(filters, effectivePlatformId),
    task: taskMemberWhere(filters.memberId),
    expense: filters.marketplaceAccountId
      ? { marketplaceAccountId: filters.marketplaceAccountId }
      : {},
  } satisfies {
    sale: Prisma.SaleWhereInput;
    inventory: Prisma.InventoryPositionWhereInput;
    task: Prisma.TaskWhereInput;
    expense: Prisma.ExpenseWhereInput;
  };
}

function sanitizeFilters(
  filters: InsightFilters,
  available: {
    platforms: Array<{ id: string }>;
    accounts: Array<{ id: string; platformId: string }>;
    categories: string[];
    members: Array<{ userId: string }>;
  }
) {
  const platformId = available.platforms.some((item) => item.id === filters.platformId)
    ? filters.platformId
    : "";
  const account = available.accounts.find(
    (item) =>
      item.id === filters.marketplaceAccountId &&
      (!platformId || item.platformId === platformId)
  );
  return {
    ...filters,
    platformId,
    marketplaceAccountId: account?.id ?? "",
    category: available.categories.includes(filters.category) ? filters.category : "",
    memberId: available.members.some((item) => item.userId === filters.memberId)
      ? filters.memberId
      : "",
  };
}

export async function loadInsightDashboard(
  db: TenantDb,
  requestedFilters: InsightFilters,
  lowStockThreshold: number,
  now = new Date()
): Promise<InsightDashboardResult> {
  const [platforms, accounts, categoryRows, members] = await Promise.all([
    db.platform.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.marketplaceAccount.findMany({
      where: { active: true },
      select: {
        id: true,
        displayName: true,
        platformId: true,
        platform: { select: { name: true } },
      },
      orderBy: [{ platform: { name: "asc" } }, { displayName: "asc" }],
    }),
    db.product.findMany({
      where: { category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
    db.membership.findMany({
      select: {
        userId: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const categories = categoryRows
    .map((item) => item.category?.trim() ?? "")
    .filter(Boolean);
  const filters = sanitizeFilters(requestedFilters, {
    platforms,
    accounts,
    categories,
    members,
  });
  const effectivePlatformId = filters.platformId;
  const period = resolveInsightPeriod(filters, now);
  const comparisonRange = {
    gte: period.previous.from,
    lte: period.current.to,
  };
  const queryScopes = buildInsightQueryScopes(filters, effectivePlatformId);
  const saleScope = queryScopes.sale;
  const [
    sales,
    inventoryPositions,
    legacyStock,
    customerReturns,
    supplierReturns,
    expenses,
    debts,
    tasks,
    purchaseDeadlines,
    importConflicts,
  ] = await Promise.all([
    db.sale.findMany({
      where: { ...saleScope, soldAt: comparisonRange },
      select: {
        id: true,
        soldAt: true,
        salePriceCents: true,
        profitCents: true,
        platformFeeCents: true,
        paymentFeeCents: true,
        shippingCostCents: true,
        status: true,
        invoiceCreated: true,
        postageBooked: true,
        feesBooked: true,
        saleLines: { select: saleLineScopeSelect },
        items: {
          select: {
            stockItem: { select: { title: true } },
            consignment: { select: { itemTitle: true } },
          },
        },
      },
    }),
    db.inventoryPosition.findMany({
      where: queryScopes.inventory,
      select: {
        id: true,
        inventoryType: true,
        receivedAt: true,
        quantityAvailable: true,
        quantityReceived: true,
        quantityReserved: true,
        quantityInspection: true,
        quantityDefective: true,
        product: { select: { name: true, variant: true } },
        ownedLot: { select: { unitPriceNet: true, legacySource: true } },
      },
    }),
    filters.ownership === "CONSIGNMENT" || filters.category || effectivePlatformId
      ? Promise.resolve([])
      : db.stockItem.findMany({
          where: {
            status: { notIn: ["CANCELLED", "WRITTEN_OFF"] },
          },
          select: {
            id: true,
            title: true,
            variant: true,
            status: true,
            purchaseDate: true,
            purchasePriceCents: true,
          },
        }),
    db.return.findMany({
      where: {
        requestedAt: {
          gte: period.current.from,
          lte: period.current.to,
        },
        sale: saleScope,
      },
      select: {
        id: true,
        requestedAt: true,
        lossCents: true,
        status: true,
        sale: {
          select: {
            saleLines: { select: saleLineScopeSelect },
          },
        },
      },
    }),
    db.supplierReturn.findMany({
      where: {
        ...(filters.category
          ? {
              lines: {
                some: { purchaseLine: { product: { category: filters.category } } },
              },
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        returnDeadline: true,
        refundExpectedAt: true,
        expectedRefundCents: true,
        actualRefundCents: true,
        lines: {
          select: {
            quantity: true,
            purchaseLine: { select: { unitPriceNet: true } },
          },
        },
      },
    }),
    db.expense.findMany({
      where: {
        status: "POSTED",
        incurredAt: { gte: period.current.from, lte: period.current.to },
        ...queryScopes.expense,
      },
      select: {
        id: true,
        incurredAt: true,
        amountGross: true,
        recurringSourceExpenseId: true,
        recurrence: { select: { id: true } },
      },
    }),
    db.debt.findMany({
      where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } },
      select: { id: true, amountCents: true, paidCents: true, dueDate: true },
    }),
    db.task.findMany({
      where: {
        archived: false,
        AND: [
          queryScopes.task,
          {
            OR: [
              { status: { in: ["OPEN", "IN_PROGRESS"] } },
              {
                completedAt: {
                  gte: period.current.from,
                  lte: period.current.to,
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        completedAt: true,
        assignee: { select: { name: true, email: true } },
        assignments: {
          select: { user: { select: { name: true, email: true } } },
        },
      },
    }),
    db.purchase.findMany({
      where: {
        returnDeadline: {
          not: null,
          gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
          lte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        },
        purchaseStatus: { not: "CANCELLED" },
        ...(filters.category
          ? { lines: { some: { product: { category: filters.category } } } }
          : {}),
      },
      select: { id: true, returnDeadline: true },
    }),
    db.sourceReference.count({
      where: {
        status: { in: [...IMPORT_REVIEW_STATUSES] },
      },
    }),
  ]);

  const migratedLegacyIds = new Set(
    inventoryPositions
      .map((position) => position.ownedLot?.legacySource)
      .filter((source): source is string => Boolean(source?.startsWith("stock_items:")))
      .map((source) => source.slice("stock_items:".length))
  );
  const inventory: InsightInventoryPosition[] = inventoryPositions.map((position) => ({
    id: position.id,
    productLabel: position.product.variant
      ? `${position.product.name} · ${position.product.variant}`
      : position.product.name,
    inventoryType: position.inventoryType,
    receivedAt: position.receivedAt,
    available: position.quantityAvailable,
    received: position.quantityReceived,
    reserved: position.quantityReserved,
    inspection: position.quantityInspection,
    defective: position.quantityDefective,
    unitCostCents: asCents(position.ownedLot?.unitPriceNet),
  }));
  for (const item of legacyStock) {
    if (migratedLegacyIds.has(item.id)) continue;
    inventory.push({
      id: `legacy:${item.id}`,
      productLabel: item.variant ? `${item.title} · ${item.variant}` : item.title,
      inventoryType: "OWNED",
      receivedAt: item.purchaseDate ?? now,
      available: item.status === "SOLD" ? 0 : 1,
      received: 1,
      reserved: item.status === "RESERVED" ? 1 : 0,
      inspection: 0,
      defective: 0,
      unitCostCents: item.purchasePriceCents,
    });
  }

  const source: InsightSourceData = {
    now,
    lowStockThreshold,
    sales: sales.map((sale) => {
      const saleScope = calculateSaleScope(toSaleLineScope(sale.saleLines), filters);
      const legacyLabels = sale.items
        .map((item) => item.stockItem?.title ?? item.consignment?.itemTitle)
        .filter((label): label is string => Boolean(label));
      return {
        id: sale.id,
        soldAt: sale.soldAt,
        revenueCents: Math.round(sale.salePriceCents * saleScope.financialRatio),
        profitCents: Math.round(sale.profitCents * saleScope.financialRatio),
        platformFeeCents: Math.round(
          (sale.platformFeeCents + sale.paymentFeeCents) *
            saleScope.financialRatio
        ),
        shippingCostCents: Math.round(
          sale.shippingCostCents * saleScope.financialRatio
        ),
        status: sale.status,
        invoiceCreated: sale.invoiceCreated,
        postageBooked: sale.postageBooked,
        feesBooked: sale.feesBooked,
        productLabels:
          saleScope.productLabels.length > 0
            ? saleScope.productLabels
            : legacyLabels,
      };
    }),
    inventory,
    customerReturns: customerReturns.map((item) => {
      const returnScope = calculateSaleScope(
        toSaleLineScope(item.sale.saleLines),
        filters
      );
      return {
        id: item.id,
        requestedAt: item.requestedAt,
        lossCents: Math.round(item.lossCents * returnScope.financialRatio),
        open: OPEN_CUSTOMER_RETURN_STATUSES.includes(
          item.status as (typeof OPEN_CUSTOMER_RETURN_STATUSES)[number]
        ),
      };
    }),
    supplierReturns: supplierReturns.map((item) => ({
      id: item.id,
      returnDeadline: item.returnDeadline,
      refundExpectedAt: item.refundExpectedAt,
      expectedRefundCents: item.expectedRefundCents,
      actualRefundCents: item.actualRefundCents,
      boundCapitalCents: item.lines.reduce(
        (total, line) => total + line.quantity * asCents(line.purchaseLine.unitPriceNet),
        0
      ),
      open: !TERMINAL_SUPPLIER_RETURN_STATUSES.includes(
        item.status as (typeof TERMINAL_SUPPLIER_RETURN_STATUSES)[number]
      ),
      refundOpen: OPEN_SUPPLIER_REFUND_STATUSES.includes(
        item.status as (typeof OPEN_SUPPLIER_REFUND_STATUSES)[number]
      ),
    })),
    expenses: expenses.map((item) => ({
      id: item.id,
      incurredAt: item.incurredAt,
      amountGrossCents: asCents(item.amountGross),
      recurring: Boolean(item.recurrence || item.recurringSourceExpenseId),
    })),
    debts: debts.map((item) => ({
      id: item.id,
      openCents: Math.max(0, item.amountCents - item.paidCents),
      dueDate: item.dueDate,
    })),
    tasks: tasks.map((task) => {
      const assignmentLabels = task.assignments.map(
        (assignment) => assignment.user.name ?? assignment.user.email
      );
      const legacyAssignee = task.assignee
        ? [task.assignee.name ?? task.assignee.email]
        : [];
      return {
        id: task.id,
        status: task.status,
        dueDate: task.dueDate,
        assigneeLabels:
          assignmentLabels.length > 0 ? assignmentLabels : legacyAssignee,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        blocker: task.priority === "URGENT" && task.status !== "DONE",
      };
    }),
    purchaseDeadlines: purchaseDeadlines.flatMap((purchase) =>
      purchase.returnDeadline
        ? [{ id: purchase.id, deadline: purchase.returnDeadline }]
        : []
    ),
    importConflicts,
  };
  const snapshot = buildInsightSnapshot(source, period);

  return {
    filters,
    period,
    options: {
      platforms: platforms.map((platform) => ({
        value: platform.id,
        label: platform.name,
      })),
      marketplaceAccounts: accounts.map((account) => ({
        value: account.id,
        label: `${account.platform.name} · ${account.displayName}`,
        parentValue: account.platformId,
      })),
      categories: categories.map((category) => ({ value: category, label: category })),
      members: members.map((member) => ({
        value: member.userId,
        label: member.user.name ?? member.user.email,
      })),
    },
    snapshot,
    dataBasis: {
      salesRows: sales.length,
      inventoryRows: inventory.length,
      generatedAt: now,
    },
  };
}
