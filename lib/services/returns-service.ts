import type {
  InventoryType,
  Prisma,
  PrismaClient,
  Return as PrismaReturn,
  ReturnAllocation,
  ReturnLine,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { calcReturnLoss } from "@/lib/calculations";
import { reserveDocumentNumber } from "@/lib/services/document-number-service";
import {
  markReturnDefective,
  receiveReturn,
  restockReturn,
} from "@/lib/services/inventory-service";

type ReturnTransaction = Prisma.TransactionClient;
type ReturnPrismaClient = Pick<PrismaClient, "$transaction">;

export interface ReturnAllocationSelectionInput {
  saleLineAllocationId: string;
  quantity: number;
}

export interface ReturnAllocationSnapshot {
  id: string;
  organizationId: string;
  saleLineId: string;
  inventoryPositionId: string;
  inventoryNumber: string;
  inventoryType: InventoryType;
  quantitySold: number;
  quantityAlreadyReturned: number;
}

export interface ReturnAllocationPlan {
  saleLineAllocationId: string;
  saleLineId: string;
  inventoryPositionId: string;
  inventoryType: InventoryType;
  quantity: number;
  returnableBefore: number;
}

export interface CreateRelationalReturnInput {
  organizationId: string;
  createdById: string;
  saleId: string;
  requestedAt: Date;
  reason?: string | null;
  refundAmountCents: number;
  extraCostCents: number;
  problemType?: string | null;
  condition?: string | null;
  notes?: string | null;
  selections: ReturnAllocationSelectionInput[];
  tx?: ReturnTransaction;
  prisma?: ReturnPrismaClient;
}

export interface CreateRelationalReturnResult {
  returnRecord: PrismaReturn;
  returnLines: Array<ReturnLine & { returnAllocations: ReturnAllocation[] }>;
}

export type ReturnWorkflowOperation = "RECEIVE" | "RESTOCK" | "DEFECTIVE";

export class ReturnsDomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_SELECTION"
      | "SALE_NOT_FOUND"
      | "RETURN_NOT_FOUND"
      | "LEGACY_RETURN_NOT_SUPPORTED"
      | "OVER_RETURN"
      | "TENANT_MISMATCH",
    message: string
  ) {
    super(message);
    this.name = "ReturnsDomainError";
  }
}

export function planReturnAllocationsFromSnapshots(input: {
  organizationId: string;
  selections: ReturnAllocationSelectionInput[];
  allocations: ReturnAllocationSnapshot[];
}): ReturnAllocationPlan[] {
  if (input.selections.length === 0) {
    throw new ReturnsDomainError(
      "INVALID_SELECTION",
      "Mindestens eine Verkaufsposition muss retourniert werden."
    );
  }

  const byId = new Map(input.allocations.map((allocation) => [allocation.id, allocation]));
  return input.selections.map((selection) => {
    const quantity = normalizeQuantity(selection.quantity);
    const allocation = byId.get(selection.saleLineAllocationId);
    if (!allocation) {
      throw new ReturnsDomainError(
        "INVALID_SELECTION",
        "Mindestens eine Verkaufs-Allocation ist ungültig."
      );
    }
    if (allocation.organizationId !== input.organizationId) {
      throw new ReturnsDomainError(
        "TENANT_MISMATCH",
        "Allocation gehört nicht zur aktiven Organisation."
      );
    }

    const returnable = allocation.quantitySold - allocation.quantityAlreadyReturned;
    if (quantity > returnable) {
      throw new ReturnsDomainError(
        "OVER_RETURN",
        `${allocation.inventoryNumber}: Es sind nur noch ${returnable} Stück retournierbar.`
      );
    }

    return {
      saleLineAllocationId: allocation.id,
      saleLineId: allocation.saleLineId,
      inventoryPositionId: allocation.inventoryPositionId,
      inventoryType: allocation.inventoryType,
      quantity,
      returnableBefore: returnable,
    };
  });
}

export async function createRelationalReturn(
  input: CreateRelationalReturnInput
): Promise<CreateRelationalReturnResult> {
  if (input.tx) return createRelationalReturnInTransaction(input.tx, input);

  const client = input.prisma ?? defaultPrisma;
  return client.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${input.organizationId}, TRUE)`;
    return createRelationalReturnInTransaction(tx, input);
  });
}

export async function applyReturnWorkflow(input: {
  organizationId: string;
  returnId: string;
  operation: ReturnWorkflowOperation;
  createdById: string;
  tx?: ReturnTransaction;
  prisma?: ReturnPrismaClient;
}): Promise<PrismaReturn> {
  if (input.tx) return applyReturnWorkflowInTransaction(input.tx, input);

  const client = input.prisma ?? defaultPrisma;
  return client.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${input.organizationId}, TRUE)`;
    return applyReturnWorkflowInTransaction(tx, input);
  });
}

async function createRelationalReturnInTransaction(
  tx: ReturnTransaction,
  input: CreateRelationalReturnInput
): Promise<CreateRelationalReturnResult> {
  const sale = await tx.sale.findFirst({
    where: {
      id: input.saleId,
      organizationId: input.organizationId,
    },
    include: {
      saleLines: {
        include: {
          allocations: {
            include: {
              inventoryPosition: true,
              returnAllocations: true,
            },
          },
        },
      },
    },
  });
  if (!sale) {
    throw new ReturnsDomainError("SALE_NOT_FOUND", "Verkauf wurde nicht gefunden.");
  }
  if (sale.saleLines.length === 0) {
    throw new ReturnsDomainError(
      "LEGACY_RETURN_NOT_SUPPORTED",
      "Neue Retouren können nur für Verkäufe mit SaleLines erfasst werden."
    );
  }

  const snapshots = sale.saleLines.flatMap((line) =>
    line.allocations.map((allocation) => ({
      id: allocation.id,
      organizationId: allocation.organizationId,
      saleLineId: line.id,
      inventoryPositionId: allocation.inventoryPositionId,
      inventoryNumber: allocation.inventoryPosition.inventoryNumber,
      inventoryType: allocation.inventoryTypeSnapshot,
      quantitySold: allocation.quantity,
      quantityAlreadyReturned: allocation.returnAllocations.reduce(
        (sum, retAllocation) => sum + retAllocation.quantity,
        0
      ),
    }))
  );

  const plan = planReturnAllocationsFromSnapshots({
    organizationId: input.organizationId,
    selections: input.selections,
    allocations: snapshots,
  });

  const returnNumber = (
    await reserveDocumentNumber(input.organizationId, "RETURN", {
      tx,
      reference: input.requestedAt,
    })
  ).display;

  const lossCents = calcReturnLoss({
    refundGrossCents: input.refundAmountCents,
    taxRatePercent: Number(sale.taxRatePercent),
    saleGrossCents: sale.salePriceCents,
    platformFeeCents: sale.platformFeeNetCents,
    paymentFeeCents: 0,
    shippingCostCents: sale.shippingCostCents,
    extraCostCents: input.extraCostCents,
  });

  const returnRecord = await tx.return.create({
    data: {
      organizationId: input.organizationId,
      returnNumber,
      saleId: sale.id,
      requestedAt: input.requestedAt,
      reason: input.reason || null,
      refundAmountCents: input.refundAmountCents,
      returnShippingCents: input.extraCostCents,
      lossCents,
      status: "REQUESTED",
      restocked: false,
      notes: input.notes || null,
    },
  });

  const byLine = new Map<string, ReturnAllocationPlan[]>();
  for (const item of plan) {
    byLine.set(item.saleLineId, [...(byLine.get(item.saleLineId) ?? []), item]);
  }

  const createdLines: Array<ReturnLine & { returnAllocations: ReturnAllocation[] }> = [];
  for (const [saleLineId, allocations] of byLine.entries()) {
    const quantity = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
    const line = await tx.returnLine.create({
      data: {
        organizationId: input.organizationId,
        returnId: returnRecord.id,
        saleLineId,
        quantity,
        problemType: input.problemType || input.reason || null,
        condition: input.condition || null,
        refundAmountCents: input.refundAmountCents || null,
        extraCostsCents: input.extraCostCents || null,
        comment: input.notes || null,
      },
    });

    const returnAllocations: ReturnAllocation[] = [];
    for (const allocation of allocations) {
      returnAllocations.push(
        await tx.returnAllocation.create({
          data: {
            organizationId: input.organizationId,
            returnLineId: line.id,
            saleLineAllocationId: allocation.saleLineAllocationId,
            quantity: allocation.quantity,
          },
        })
      );
    }

    createdLines.push({ ...line, returnAllocations });
  }

  if (input.refundAmountCents > 0) {
    await tx.sale.update({
      where: { id: sale.id },
      data: { status: "REFUNDED" },
    });
  }

  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.createdById,
      action: "return.create_v2",
      entityType: "Return",
      entityId: returnRecord.id,
      after: {
        returnNumber,
        saleNumber: sale.orderNumber,
        quantity: plan.reduce((sum, item) => sum + item.quantity, 0),
        refundAmountCents: input.refundAmountCents,
        lossCents,
      },
    },
  });

  return { returnRecord, returnLines: createdLines };
}

async function applyReturnWorkflowInTransaction(
  tx: ReturnTransaction,
  input: {
    organizationId: string;
    returnId: string;
    operation: ReturnWorkflowOperation;
    createdById: string;
  }
): Promise<PrismaReturn> {
  const ret = await tx.return.findFirst({
    where: { id: input.returnId, organizationId: input.organizationId },
    include: {
      returnLines: {
        include: {
          returnAllocations: {
            include: {
              saleLineAllocation: {
                include: {
                  inventoryPosition: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!ret) {
    throw new ReturnsDomainError("RETURN_NOT_FOUND", "Retoure wurde nicht gefunden.");
  }
  if (ret.returnLines.length === 0) {
    throw new ReturnsDomainError(
      "LEGACY_RETURN_NOT_SUPPORTED",
      "Legacy-Retouren ohne ReturnLines können nicht automatisch gebucht werden."
    );
  }

  for (const line of ret.returnLines) {
    for (const allocation of line.returnAllocations) {
      const position = allocation.saleLineAllocation.inventoryPosition;
      const inventoryType = allocation.saleLineAllocation.inventoryTypeSnapshot;
      let receiptMovementId = allocation.receiptMovementId;

      if (!receiptMovementId) {
        const receipt = await receiveReturn({
          organizationId: input.organizationId,
          inventoryPositionId: position.id,
          quantity: allocation.quantity,
          referenceType: "ReturnAllocation",
          referenceId: allocation.id,
          referenceAction: "return_receipt",
          idempotencyKey: `return:${ret.id}:allocation:${allocation.id}:receipt`,
          comment: `Retoure ${ret.returnNumber ?? ret.id} eingegangen`,
          createdById: input.createdById,
          requiredInventoryType: inventoryType,
          tx,
        });
        receiptMovementId = receipt.movement.id;
        await tx.returnAllocation.update({
          where: { id: allocation.id },
          data: { receiptMovementId },
        });
      }

      if (input.operation === "RESTOCK" && !allocation.restockMovementId) {
        const restock = await restockReturn({
          organizationId: input.organizationId,
          inventoryPositionId: position.id,
          quantity: allocation.quantity,
          referenceType: "ReturnAllocation",
          referenceId: allocation.id,
          referenceAction: "return_restock",
          idempotencyKey: `return:${ret.id}:allocation:${allocation.id}:restock`,
          comment: `Retoure ${ret.returnNumber ?? ret.id} wieder verkaufbar`,
          createdById: input.createdById,
          requiredInventoryType: inventoryType,
          tx,
        });
        await tx.returnAllocation.update({
          where: { id: allocation.id },
          data: { restockMovementId: restock.movement.id },
        });
      }

      if (input.operation === "DEFECTIVE" && !allocation.defectiveMovementId) {
        const defective = await markReturnDefective({
          organizationId: input.organizationId,
          inventoryPositionId: position.id,
          quantity: allocation.quantity,
          referenceType: "ReturnAllocation",
          referenceId: allocation.id,
          referenceAction: "return_defective",
          idempotencyKey: `return:${ret.id}:allocation:${allocation.id}:defective`,
          comment: `Retoure ${ret.returnNumber ?? ret.id} defekt`,
          createdById: input.createdById,
          requiredInventoryType: inventoryType,
          tx,
        });
        await tx.returnAllocation.update({
          where: { id: allocation.id },
          data: { defectiveMovementId: defective.movement.id },
        });
      }
    }
  }

  const nextStatus =
    input.operation === "RECEIVE"
      ? "RECEIVED"
      : input.operation === "RESTOCK"
      ? "RESTOCKED"
      : input.operation === "DEFECTIVE"
        ? "CONFLICT"
        : ret.status;

  return tx.return.update({
    where: { id: ret.id },
    data: {
      status: nextStatus,
      restocked: input.operation === "RESTOCK" ? true : ret.restocked,
      receivedAt: ret.receivedAt ?? new Date(),
    },
  });
}

function normalizeQuantity(value: number): number {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ReturnsDomainError("INVALID_SELECTION", "Menge muss mindestens 1 sein.");
  }
  return quantity;
}
