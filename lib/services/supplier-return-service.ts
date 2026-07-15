import type {
  InventoryBucket,
  InventoryType,
  ItemCondition,
  Prisma,
  PrismaClient,
  SupplierReturn,
  SupplierReturnStatus,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { returnOwnedStockToSupplier } from "@/lib/services/inventory-service";
import { reserveDocumentNumber } from "@/lib/services/document-number-service";

type SupplierReturnTransaction = Prisma.TransactionClient;
type SupplierReturnPrismaClient = Pick<PrismaClient, "$transaction">;

const SOURCE_BUCKETS: InventoryBucket[] = [
  "AVAILABLE",
  "RESERVED",
  "INSPECTION",
  "DEFECTIVE",
];

const TRANSITIONS: Record<SupplierReturnStatus, SupplierReturnStatus[]> = {
  DRAFT: ["REQUESTED", "CANCELLED"],
  REQUESTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["DISPATCHED", "REJECTED", "CANCELLED"],
  DISPATCHED: ["ARRIVED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "CREDIT_PENDING", "REPLACEMENT_PENDING"],
  ARRIVED: ["REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "REPLACEMENT_PENDING", "COMPLETED"],
  REFUND_PENDING: ["PARTIALLY_REFUNDED", "REFUNDED", "COMPLETED"],
  PARTIALLY_REFUNDED: ["REFUNDED", "COMPLETED"],
  REFUNDED: ["COMPLETED"],
  REJECTED: [],
  CREDIT_PENDING: ["PARTIALLY_REFUNDED", "REFUNDED", "COMPLETED"],
  REPLACEMENT_PENDING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export interface SupplierReturnSelectionInput {
  purchaseLineId: string;
  inventoryPositionId: string;
  sourceBucket: InventoryBucket;
  quantity: number;
  reason?: string | null;
  itemCondition?: ItemCondition | null;
  legacyCondition?: string | null;
}

export interface SupplierReturnInventorySnapshot {
  organizationId: string;
  purchaseId: string;
  purchaseLineId: string;
  inventoryPositionId: string;
  inventoryType: InventoryType;
  quantities: Record<InventoryBucket, number>;
  unitPriceNetCents: number;
}

export interface SupplierReturnLinePlan extends SupplierReturnSelectionInput {
  boundCapitalCents: number;
}

export interface CreateSupplierReturnInput {
  organizationId: string;
  createdById: string;
  purchaseId: string;
  requestedAt: Date;
  returnDeadline?: Date | null;
  rmaNumber?: string | null;
  notes?: string | null;
  documentUrls?: string[];
  evidenceUrls?: string[];
  expectedRefundCents?: number;
  shippingCostCents?: number;
  selections: SupplierReturnSelectionInput[];
  tx?: SupplierReturnTransaction;
  prisma?: SupplierReturnPrismaClient;
}

export class SupplierReturnDomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_SELECTION"
      | "PURCHASE_NOT_FOUND"
      | "RETURN_NOT_FOUND"
      | "TENANT_MISMATCH"
      | "INSUFFICIENT_STOCK"
      | "INVALID_TRANSITION"
      | "INVALID_AMOUNT",
    message: string
  ) {
    super(message);
    this.name = "SupplierReturnDomainError";
  }
}

export function planSupplierReturnLinesFromSnapshots(input: {
  organizationId: string;
  purchaseId: string;
  selections: SupplierReturnSelectionInput[];
  snapshots: SupplierReturnInventorySnapshot[];
}): SupplierReturnLinePlan[] {
  if (input.selections.length === 0) {
    throw new SupplierReturnDomainError(
      "INVALID_SELECTION",
      "Mindestens eine Einkaufsposition muss ausgewählt werden."
    );
  }

  const snapshots = new Map(
    input.snapshots.map((item) => [
      `${item.purchaseLineId}:${item.inventoryPositionId}`,
      item,
    ])
  );
  const selectedBuckets = new Set<string>();

  return input.selections.map((selection) => {
    const quantity = normalizeQuantity(selection.quantity);
    if (!SOURCE_BUCKETS.includes(selection.sourceBucket)) {
      throw new SupplierReturnDomainError(
        "INVALID_SELECTION",
        "Der ausgewählte Bestands-Bucket ist ungültig."
      );
    }

    const key = `${selection.purchaseLineId}:${selection.inventoryPositionId}`;
    const bucketKey = `${key}:${selection.sourceBucket}`;
    if (selectedBuckets.has(bucketKey)) {
      throw new SupplierReturnDomainError(
        "INVALID_SELECTION",
        "Dieselbe Bestandsposition und derselbe Bucket wurden doppelt ausgewählt."
      );
    }
    selectedBuckets.add(bucketKey);

    const snapshot = snapshots.get(key);
    if (!snapshot) {
      throw new SupplierReturnDomainError(
        "INVALID_SELECTION",
        "Die ausgewählte Einkaufs- oder Bestandsposition wurde nicht gefunden."
      );
    }
    if (snapshot.organizationId !== input.organizationId) {
      throw new SupplierReturnDomainError(
        "TENANT_MISMATCH",
        "Bestandsposition gehört nicht zur aktiven Organisation."
      );
    }
    if (snapshot.purchaseId !== input.purchaseId) {
      throw new SupplierReturnDomainError(
        "INVALID_SELECTION",
        "Bestandsposition gehört nicht zum ausgewählten Einkauf."
      );
    }
    if (snapshot.inventoryType !== "OWNED") {
      throw new SupplierReturnDomainError(
        "INVALID_SELECTION",
        "Lieferantenretouren können nur aus Eigenbestand erstellt werden."
      );
    }

    const available = snapshot.quantities[selection.sourceBucket];
    if (quantity > available) {
      throw new SupplierReturnDomainError(
        "INSUFFICIENT_STOCK",
        `Im ausgewählten Bucket sind nur ${available} Stück verfügbar.`
      );
    }

    return {
      ...selection,
      quantity,
      boundCapitalCents: quantity * snapshot.unitPriceNetCents,
    };
  });
}

export function assertSupplierReturnTransition(
  current: SupplierReturnStatus,
  next: SupplierReturnStatus
): void {
  if (current === next) return;
  if (!TRANSITIONS[current]?.includes(next)) {
    throw new SupplierReturnDomainError(
      "INVALID_TRANSITION",
      `Statuswechsel von ${current} nach ${next} ist nicht zulässig.`
    );
  }
}

export function classifySupplierRefund(input: {
  expectedCents: number;
  actualCents: number;
}): Extract<
  SupplierReturnStatus,
  "REFUND_PENDING" | "PARTIALLY_REFUNDED" | "REFUNDED"
> {
  assertNonNegativeAmount(input.expectedCents, "Erwartete Erstattung");
  assertNonNegativeAmount(input.actualCents, "Tatsächliche Erstattung");
  if (input.actualCents === 0) return "REFUND_PENDING";
  if (input.expectedCents === 0 || input.actualCents >= input.expectedCents) {
    return "REFUNDED";
  }
  return "PARTIALLY_REFUNDED";
}

export type SupplierReturnDeadlineState = "OVERDUE" | "DUE_SOON" | "ON_TRACK";

export function getSupplierReturnDeadlineState(
  deadline: Date,
  now = new Date()
): SupplierReturnDeadlineState {
  const deadlineDay = Date.UTC(
    deadline.getUTCFullYear(),
    deadline.getUTCMonth(),
    deadline.getUTCDate()
  );
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((deadlineDay - nowDay) / 86_400_000);
  if (days < 0) return "OVERDUE";
  if (days <= 7) return "DUE_SOON";
  return "ON_TRACK";
}

export async function createSupplierReturn(
  input: CreateSupplierReturnInput
): Promise<SupplierReturn> {
  assertNonNegativeAmount(input.expectedRefundCents ?? 0, "Erwartete Erstattung");
  assertNonNegativeAmount(input.shippingCostCents ?? 0, "Versandkosten");
  return withSupplierReturnTransaction(input.organizationId, input, (tx) =>
    createSupplierReturnInTransaction(tx, input)
  );
}

export async function dispatchSupplierReturn(input: {
  organizationId: string;
  supplierReturnId: string;
  createdById: string;
  dispatchedAt?: Date;
  carrier?: string | null;
  trackingNumber?: string | null;
  tx?: SupplierReturnTransaction;
  prisma?: SupplierReturnPrismaClient;
}): Promise<SupplierReturn> {
  return withSupplierReturnTransaction(input.organizationId, input, async (tx) => {
    const supplierReturn = await tx.supplierReturn.findFirst({
      where: { id: input.supplierReturnId, organizationId: input.organizationId },
      include: { lines: true },
    });
    if (!supplierReturn) throw returnNotFound();

    const alreadyDispatched = supplierReturn.lines.every(
      (line) => line.outboundMovementId !== null
    );
    if (supplierReturn.status === "DISPATCHED" && alreadyDispatched) {
      return supplierReturn;
    }
    assertSupplierReturnTransition(supplierReturn.status, "DISPATCHED");

    for (const line of supplierReturn.lines) {
      if (line.outboundMovementId) continue;
      const result = await returnOwnedStockToSupplier({
        organizationId: input.organizationId,
        inventoryPositionId: line.inventoryPositionId,
        quantity: line.quantity,
        sourceBucket: line.sourceBucket,
        referenceType: "SupplierReturnLine",
        referenceId: line.id,
        referenceAction: "supplier_return_dispatch",
        idempotencyKey: `supplier-return:${supplierReturn.id}:line:${line.id}:dispatch`,
        comment: `Lieferantenretoure ${supplierReturn.returnNumber ?? supplierReturn.id} versendet`,
        createdById: input.createdById,
        tx,
      });
      await tx.supplierReturnLine.update({
        where: { id: line.id },
        data: { outboundMovementId: result.movement.id },
      });
    }

    const updateResult = await tx.supplierReturn.updateMany({
      where: {
        id: supplierReturn.id,
        organizationId: input.organizationId,
        status: supplierReturn.status,
      },
      data: {
        status: "DISPATCHED",
        dispatchedAt: input.dispatchedAt ?? new Date(),
        carrier: input.carrier ?? supplierReturn.carrier,
        trackingNumber: input.trackingNumber ?? supplierReturn.trackingNumber,
      },
    });
    if (updateResult.count !== 1) throw concurrentSupplierReturnChange();
    const updated = await tx.supplierReturn.findFirst({
      where: { id: supplierReturn.id, organizationId: input.organizationId },
    });
    if (!updated) throw returnNotFound();
    await auditStatus(tx, input.organizationId, input.createdById, updated, supplierReturn.status);
    return updated;
  });
}

export async function transitionSupplierReturn(input: {
  organizationId: string;
  supplierReturnId: string;
  nextStatus: SupplierReturnStatus;
  createdById: string;
  rejectionReason?: string | null;
  tx?: SupplierReturnTransaction;
  prisma?: SupplierReturnPrismaClient;
}): Promise<SupplierReturn> {
  return withSupplierReturnTransaction(input.organizationId, input, async (tx) => {
    const current = await tx.supplierReturn.findFirst({
      where: { id: input.supplierReturnId, organizationId: input.organizationId },
    });
    if (!current) throw returnNotFound();
    assertSupplierReturnTransition(current.status, input.nextStatus);
    if (current.status === input.nextStatus) return current;

    const now = new Date();
    const updateResult = await tx.supplierReturn.updateMany({
      where: {
        id: current.id,
        organizationId: input.organizationId,
        status: current.status,
      },
      data: {
        status: input.nextStatus,
        arrivedAt: input.nextStatus === "ARRIVED" ? now : current.arrivedAt,
        completedAt: input.nextStatus === "COMPLETED" ? now : current.completedAt,
        rejectionReason:
          input.nextStatus === "REJECTED"
            ? input.rejectionReason || "Vom Lieferanten abgelehnt"
            : current.rejectionReason,
      },
    });
    if (updateResult.count !== 1) throw concurrentSupplierReturnChange();
    const updated = await tx.supplierReturn.findFirst({
      where: { id: current.id, organizationId: input.organizationId },
    });
    if (!updated) throw returnNotFound();
    await auditStatus(tx, input.organizationId, input.createdById, updated, current.status);
    return updated;
  });
}

export async function recordSupplierReturnRefund(input: {
  organizationId: string;
  supplierReturnId: string;
  actualRefundCents: number;
  creditReference?: string | null;
  createdById: string;
  tx?: SupplierReturnTransaction;
  prisma?: SupplierReturnPrismaClient;
}): Promise<SupplierReturn> {
  assertNonNegativeAmount(input.actualRefundCents, "Tatsächliche Erstattung");
  return withSupplierReturnTransaction(input.organizationId, input, async (tx) => {
    const current = await tx.supplierReturn.findFirst({
      where: { id: input.supplierReturnId, organizationId: input.organizationId },
    });
    if (!current) throw returnNotFound();
    const status = classifySupplierRefund({
      expectedCents: current.expectedRefundCents,
      actualCents: input.actualRefundCents,
    });
    assertSupplierReturnTransition(current.status, status);

    const updateResult = await tx.supplierReturn.updateMany({
      where: {
        id: current.id,
        organizationId: input.organizationId,
        status: current.status,
      },
      data: {
        status,
        actualRefundCents: input.actualRefundCents,
        creditReference: input.creditReference ?? current.creditReference,
        refundedAt: status === "REFUNDED" ? new Date() : null,
      },
    });
    if (updateResult.count !== 1) throw concurrentSupplierReturnChange();
    const updated = await tx.supplierReturn.findFirst({
      where: { id: current.id, organizationId: input.organizationId },
    });
    if (!updated) throw returnNotFound();
    await auditStatus(tx, input.organizationId, input.createdById, updated, current.status);
    return updated;
  });
}

async function createSupplierReturnInTransaction(
  tx: SupplierReturnTransaction,
  input: CreateSupplierReturnInput
): Promise<SupplierReturn> {
  const purchase = await tx.purchase.findFirst({
    where: { id: input.purchaseId, organizationId: input.organizationId },
    include: {
      lines: {
        include: {
          ownedLots: { include: { inventoryPosition: true } },
        },
      },
      businessPartner: true,
    },
  });
  if (!purchase) {
    throw new SupplierReturnDomainError(
      "PURCHASE_NOT_FOUND",
      "Einkauf wurde nicht gefunden."
    );
  }

  const snapshots: SupplierReturnInventorySnapshot[] = purchase.lines.flatMap((line) =>
    line.ownedLots.map((lot) => ({
      organizationId: lot.organizationId,
      purchaseId: purchase.id,
      purchaseLineId: line.id,
      inventoryPositionId: lot.inventoryPositionId,
      inventoryType: lot.inventoryPosition.inventoryType,
      quantities: {
        AVAILABLE: lot.inventoryPosition.quantityAvailable,
        RESERVED: lot.inventoryPosition.quantityReserved,
        INSPECTION: lot.inventoryPosition.quantityInspection,
        DEFECTIVE: lot.inventoryPosition.quantityDefective,
      },
      unitPriceNetCents: Math.round(Number(line.unitPriceNet) * 100),
    }))
  );
  const plan = planSupplierReturnLinesFromSnapshots({
    organizationId: input.organizationId,
    purchaseId: input.purchaseId,
    selections: input.selections,
    snapshots,
  });
  const returnNumber = (
    await reserveDocumentNumber(input.organizationId, "SUPPLIER_RETURN", {
      tx,
      reference: input.requestedAt,
    })
  ).display;

  const supplierReturn = await tx.supplierReturn.create({
    data: {
      organizationId: input.organizationId,
      returnNumber,
      purchaseId: purchase.id,
      supplierId: purchase.businessPartnerId,
      supplierSnapshot: purchase.businessPartner?.displayName ?? purchase.vendor,
      status: "DRAFT",
      requestedAt: input.requestedAt,
      returnDeadline: input.returnDeadline ?? purchase.returnDeadline,
      rmaNumber: input.rmaNumber || null,
      expectedRefundCents: input.expectedRefundCents ?? 0,
      shippingCostCents: input.shippingCostCents ?? 0,
      notes: input.notes || null,
      documentUrls: input.documentUrls ?? [],
      evidenceUrls: input.evidenceUrls ?? [],
      createdById: input.createdById,
      lines: {
        create: plan.map((line) => ({
          organizationId: input.organizationId,
          purchaseLineId: line.purchaseLineId,
          inventoryPositionId: line.inventoryPositionId,
          sourceBucket: line.sourceBucket,
          quantity: line.quantity,
          reason: line.reason || null,
          itemCondition: line.itemCondition ?? null,
          legacyCondition: line.legacyCondition || null,
        })),
      },
    },
  });
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.createdById,
      action: "supplier_return.create",
      entityType: "SupplierReturn",
      entityId: supplierReturn.id,
      after: {
        returnNumber,
        purchaseNumber: purchase.purchaseNumber,
        quantity: plan.reduce((sum, line) => sum + line.quantity, 0),
        boundCapitalCents: plan.reduce((sum, line) => sum + line.boundCapitalCents, 0),
      },
    },
  });
  return supplierReturn;
}

async function withSupplierReturnTransaction<T>(
  organizationId: string,
  options: { tx?: SupplierReturnTransaction; prisma?: SupplierReturnPrismaClient },
  operation: (tx: SupplierReturnTransaction) => Promise<T>
): Promise<T> {
  if (options.tx) return operation(options.tx);
  const client = options.prisma ?? defaultPrisma;
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    return operation(tx);
  });
}

async function auditStatus(
  tx: SupplierReturnTransaction,
  organizationId: string,
  userId: string,
  supplierReturn: SupplierReturn,
  previousStatus: SupplierReturnStatus
): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "supplier_return.status",
      entityType: "SupplierReturn",
      entityId: supplierReturn.id,
      before: { status: previousStatus },
      after: {
        status: supplierReturn.status,
        actualRefundCents: supplierReturn.actualRefundCents,
      },
    },
  });
}

function normalizeQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new SupplierReturnDomainError(
      "INVALID_SELECTION",
      "Menge muss mindestens 1 sein."
    );
  }
  return value;
}

function assertNonNegativeAmount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new SupplierReturnDomainError(
      "INVALID_AMOUNT",
      `${label} muss als nicht-negativer Centbetrag angegeben werden.`
    );
  }
}

function returnNotFound(): SupplierReturnDomainError {
  return new SupplierReturnDomainError(
    "RETURN_NOT_FOUND",
    "Lieferantenretoure wurde nicht gefunden."
  );
}

function concurrentSupplierReturnChange(): SupplierReturnDomainError {
  return new SupplierReturnDomainError(
    "INVALID_TRANSITION",
    "Die Lieferantenretoure wurde parallel geändert. Bitte Ansicht aktualisieren."
  );
}
