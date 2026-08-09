import { Prisma } from "@prisma/client";
import { getOptions } from "@/lib/options";
import { withTenantReadTransaction, type TenantDb } from "@/lib/tenant-db";
import type { PurchaseOperationalRow } from "@/components/purchases/purchase-table";
import {
  buildPurchaseOrderBy,
  buildPurchaseWhere,
  parsePurchaseTableQuery,
  type PurchaseTableQuery,
} from "@/lib/purchases/purchase-table";
import { effectiveReceivedQuantity } from "@/lib/services/owned-purchase-service";

interface PurchaseReadTrace {
  measureDb<T>(name: string, task: () => Promise<T>, queryCount?: number): Promise<T>;
}

export type PurchaseReadParams = Record<string, string | string[] | undefined>;

export interface PurchaseInitialReadResult {
  rows: PurchaseOperationalRow[];
  suppliers: Array<{ id: string; label: string }>;
  paymentMethods: string[];
  totalResults: number;
  query: PurchaseTableQuery;
  rowCounts: {
    purchases: number;
    lines: number;
    suppliers: number;
    paymentMethods: number;
  };
}

export interface PurchaseDetailReadResult {
  receipts: PurchaseOperationalRow["receipts"];
  lots: PurchaseOperationalRow["lots"];
}

const purchaseListSelect = {
  id: true,
  purchaseNumber: true,
  purchaseDate: true,
  vendor: true,
  supplierOrderNumber: true,
  purchaseStatus: true,
  shippingStatus: true,
  shippingCarrier: true,
  trackingNumber: true,
  expectedDeliveryAt: true,
  receivedAt: true,
  returnDeadline: true,
  paymentMethod: true,
  comment: true,
  businessPartner: { select: { displayName: true } },
  debtLinks: { select: { id: true } },
  lines: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      totalGross: true,
      totalNet: true,
      unitPriceGross: true,
      product: {
        select: {
          name: true,
          variant: true,
          defaultCondition: true,
          imageUrls: true,
        },
      },
    },
  },
} satisfies Prisma.PurchaseSelect;

const purchaseDetailSelect = {
  lines: {
    select: {
      product: { select: { name: true, variant: true } },
      receiptLines: {
        select: {
          quantity: true,
          inventoryPositionId: true,
          inboundMovement: { select: { id: true } },
          inventoryPosition: {
            select: {
              inventoryNumber: true,
              receivedAt: true,
            },
          },
          purchaseReceipt: {
            select: {
              id: true,
              cancelledAt: true,
              receivedAt: true,
            },
          },
        },
      },
      ownedLots: {
        select: {
          inventoryPositionId: true,
          inventoryPosition: {
            select: {
              inventoryNumber: true,
              receivedAt: true,
              quantityReceived: true,
              movements: {
                where: { movementType: "PURCHASE_RECEIPT" },
                select: { id: true },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PurchaseSelect;

type PurchaseListRecord = Prisma.PurchaseGetPayload<{ select: typeof purchaseListSelect }>;
type PurchaseDetailRecord = Prisma.PurchaseGetPayload<{ select: typeof purchaseDetailSelect }>;
type ReceiptSummaryRow = {
  purchaseLineId: string;
  quantity: number;
  inventoryPositionId: string;
  purchaseReceipt: { cancelledAt: Date | null };
};
type LegacyLotSummaryRow = {
  purchaseLineId: string | null;
  inventoryPositionId: string;
  inventoryPosition: { quantityReceived: number };
};

export async function loadPurchaseInitialRead(input: {
  db: TenantDb;
  organizationId: string;
  params: PurchaseReadParams;
  trace?: PurchaseReadTrace;
}): Promise<PurchaseInitialReadResult> {
  const { db, organizationId, params, trace } = input;
  const measureDb = <T>(name: string, task: () => Promise<T>, queryCount = 2) =>
    trace ? trace.measureDb(name, task, queryCount) : task();
  const requested = parsePurchaseTableQuery(params);
  const where = buildPurchaseWhere(requested);
  const optionsPromise = Promise.all([
    measureDb("purchase.options.suppliers", () =>
      db.businessPartner.findMany({
        where: { active: true, roles: { some: { role: "SUPPLIER" } } },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      })
    ),
    measureDb("purchase.options.payment_methods", () =>
      getOptions(db, organizationId, "PAYMENT_METHOD")
    ),
  ]);

  const totalResults = await measureDb("purchase.count", () =>
    db.purchase.count({ where })
  );
  const totalPages = Math.max(1, Math.ceil(totalResults / requested.pageSize));
  const query = { ...requested, page: Math.min(requested.page, totalPages) };
  const [purchases, [suppliers, paymentMethods]] = await Promise.all([
    measureDb("purchase.list.slim", () =>
      db.purchase.findMany({
        where,
        orderBy: buildPurchaseOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: purchaseListSelect,
      })
    ),
    optionsPromise,
  ]);

  const purchaseLineIds = purchases.flatMap((purchase) =>
    purchase.lines.map((line) => line.id)
  );
  const receivedByLineId = purchaseLineIds.length
    ? await measureDb(
        "purchase.received_summary",
        () => loadPurchaseReceivedQuantities(organizationId, purchaseLineIds),
        2
      )
    : new Map<string, number>();
  const rows = purchases.map((purchase) =>
    toPurchaseOperationalRow(purchase, receivedByLineId)
  );
  const supplierOptions = suppliers.map((item) => ({ id: item.id, label: item.displayName }));

  return {
    rows,
    suppliers: supplierOptions,
    paymentMethods,
    totalResults,
    query,
    rowCounts: {
      purchases: purchases.length,
      lines: purchases.reduce((sum, purchase) => sum + purchase.lines.length, 0),
      suppliers: supplierOptions.length,
      paymentMethods: paymentMethods.length,
    },
  };
}

export async function loadPurchaseDetailRead(input: {
  db: TenantDb;
  purchaseId: string;
}): Promise<PurchaseDetailReadResult | null> {
  const purchase = await input.db.purchase.findFirst({
    where: { id: input.purchaseId },
    select: purchaseDetailSelect,
  });
  if (!purchase) return null;
  return toPurchaseDetailRead(purchase);
}

async function loadPurchaseReceivedQuantities(
  organizationId: string,
  purchaseLineIds: string[]
): Promise<Map<string, number>> {
  const lineValues = Prisma.join(
    purchaseLineIds.map((lineId) => Prisma.sql`(${lineId}::text)`)
  );
  const rows = await withTenantReadTransaction(organizationId, (tx) =>
    tx.$queryRaw<Array<{ purchaseLineId: string; received: number | bigint }>>(Prisma.sql`
      WITH requested_lines(id) AS (VALUES ${lineValues}),
      receipt_positions AS (
        SELECT prl.purchase_line_id, prl.inventory_position_id
        FROM purchase_receipt_lines prl
        JOIN requested_lines rl ON rl.id = prl.purchase_line_id
      ),
      receipt_totals AS (
        SELECT
          prl.purchase_line_id,
          COALESCE(SUM(CASE WHEN pr.cancelled_at IS NULL THEN prl.quantity ELSE 0 END), 0)::int AS quantity
        FROM purchase_receipt_lines prl
        JOIN purchase_receipts pr ON pr.id = prl.purchase_receipt_id
        JOIN requested_lines rl ON rl.id = prl.purchase_line_id
        GROUP BY prl.purchase_line_id
      ),
      legacy_totals AS (
        SELECT
          osl.purchase_line_id,
          COALESCE(SUM(ip.quantity_received), 0)::int AS quantity
        FROM owned_stock_lots osl
        JOIN inventory_positions ip ON ip.id = osl.inventory_position_id
        JOIN requested_lines rl ON rl.id = osl.purchase_line_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM receipt_positions rp
          WHERE rp.purchase_line_id = osl.purchase_line_id
            AND rp.inventory_position_id = osl.inventory_position_id
        )
        GROUP BY osl.purchase_line_id
      )
      SELECT
        rl.id AS "purchaseLineId",
        (COALESCE(rt.quantity, 0) + COALESCE(lt.quantity, 0))::int AS "received"
      FROM requested_lines rl
      LEFT JOIN receipt_totals rt ON rt.purchase_line_id = rl.id
      LEFT JOIN legacy_totals lt ON lt.purchase_line_id = rl.id
    `)
  );
  return new Map(
    rows.map((row) => [row.purchaseLineId, Number(row.received)])
  );
}

export function calculateReceivedQuantityByLine(
  purchaseLineIds: readonly string[],
  receiptLines: readonly ReceiptSummaryRow[],
  legacyLots: readonly LegacyLotSummaryRow[]
): Map<string, number> {
  const summaries = new Map<
    string,
    {
      receiptQuantities: number[];
      receiptInventoryPositionIds: string[];
      legacyLots: Array<{ inventoryPositionId: string; quantity: number }>;
    }
  >();
  for (const lineId of purchaseLineIds) {
    summaries.set(lineId, {
      receiptQuantities: [],
      receiptInventoryPositionIds: [],
      legacyLots: [],
    });
  }
  for (const receiptLine of receiptLines) {
    const summary = summaries.get(receiptLine.purchaseLineId);
    if (!summary) continue;
    summary.receiptQuantities.push(
      receiptLine.purchaseReceipt.cancelledAt ? 0 : receiptLine.quantity
    );
    summary.receiptInventoryPositionIds.push(receiptLine.inventoryPositionId);
  }
  for (const lot of legacyLots) {
    if (!lot.purchaseLineId) continue;
    const summary = summaries.get(lot.purchaseLineId);
    if (!summary) continue;
    summary.legacyLots.push({
      inventoryPositionId: lot.inventoryPositionId,
      quantity: lot.inventoryPosition.quantityReceived,
    });
  }

  return new Map(
    [...summaries].map(([lineId, summary]) => [
      lineId,
      effectiveReceivedQuantity({
        receiptQuantities: summary.receiptQuantities,
        legacyLotQuantities: summary.legacyLots.map((lot) => lot.quantity),
        receiptInventoryPositionIds: summary.receiptInventoryPositionIds,
        legacyLots: summary.legacyLots,
      }),
    ])
  );
}

function toPurchaseOperationalRow(
  purchase: PurchaseListRecord,
  receivedByLineId: ReadonlyMap<string, number>
): PurchaseOperationalRow {
  return {
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    purchaseDate: purchase.purchaseDate.toISOString(),
    supplier: purchase.businessPartner?.displayName ?? purchase.vendor,
    supplierOrderNumber: purchase.supplierOrderNumber ?? "",
    status: purchase.purchaseStatus,
    shippingStatus: purchase.shippingStatus,
    shippingCarrier: purchase.shippingCarrier ?? "",
    trackingNumber: purchase.trackingNumber ?? "",
    expectedDeliveryAt: purchase.expectedDeliveryAt?.toISOString() ?? null,
    receivedAt: purchase.receivedAt?.toISOString() ?? null,
    returnDeadline: purchase.returnDeadline?.toISOString() ?? null,
    grossCents: purchase.lines.reduce((sum, line) => sum + decimalToCents(line.totalGross), 0),
    netCents: purchase.lines.reduce((sum, line) => sum + decimalToCents(line.totalNet), 0),
    paymentMethod: purchase.paymentMethod,
    comment: purchase.comment ?? "",
    debtCount: purchase.debtLinks.length,
    lines: purchase.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      product: [line.product.name, line.product.variant].filter(Boolean).join(" · "),
      imageUrl: line.product.imageUrls[0] ?? null,
      condition: line.product.defaultCondition,
      quantity: line.quantity,
      received: receivedByLineId.get(line.id) ?? 0,
      grossCents: decimalToCents(line.totalGross),
      unitGrossCents: decimalToCents(line.unitPriceGross),
      netCents: decimalToCents(line.totalNet),
    })),
    receipts: [],
    lots: [],
  };
}

function toPurchaseDetailRead(purchase: PurchaseDetailRecord): PurchaseDetailReadResult {
  const receipts = new Map<string, PurchaseOperationalRow["receipts"][number]>();
  for (const line of purchase.lines) {
    const product = [line.product.name, line.product.variant].filter(Boolean).join(" · ");
    for (const receiptLine of line.receiptLines) {
      const receipt = receipts.get(receiptLine.purchaseReceipt.id) ?? {
        id: receiptLine.purchaseReceipt.id,
        receivedAt: receiptLine.purchaseReceipt.receivedAt.toISOString(),
        cancelledAt: receiptLine.purchaseReceipt.cancelledAt?.toISOString() ?? null,
        lines: [],
      };
      receipt.lines.push({ product, quantity: receiptLine.quantity });
      receipts.set(receipt.id, receipt);
    }
  }

  const receiptPositionIds = new Set(
    purchase.lines.flatMap((line) =>
      line.receiptLines.map((receipt) => receipt.inventoryPositionId)
    )
  );
  const lots = purchase.lines.flatMap((line) => [
    ...line.receiptLines.map((receipt) => ({
      inventoryNumber: receipt.inventoryPosition.inventoryNumber,
      quantity: receipt.quantity,
      receivedAt: receipt.inventoryPosition.receivedAt.toISOString(),
      movementId: receipt.inboundMovement.id,
      cancelled: Boolean(receipt.purchaseReceipt.cancelledAt),
    })),
    ...line.ownedLots
      .filter((lot) => !receiptPositionIds.has(lot.inventoryPositionId))
      .map((lot) => ({
        inventoryNumber: lot.inventoryPosition.inventoryNumber,
        quantity: lot.inventoryPosition.quantityReceived,
        receivedAt: lot.inventoryPosition.receivedAt.toISOString(),
        movementId: lot.inventoryPosition.movements[0]?.id ?? "Legacy",
        cancelled: false,
      })),
  ]);

  return {
    receipts: [...receipts.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    lots,
  };
}

function decimalToCents(value: { toString(): string }) {
  return Math.round(Number(value.toString()) * 100);
}
