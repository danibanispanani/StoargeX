import type {
  InventoryType,
  Prisma,
  PrismaClient,
  Sale,
  SaleLine,
  SaleLineAllocation,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  calcSale,
  grossToNetCents,
} from "@/lib/calculations";
import { reserveDocumentNumber } from "@/lib/services/document-number-service";
import { reverseMovement, sell } from "@/lib/services/inventory-service";
import { centsToDecimalString } from "@/lib/services/owned-purchase-service";

type SalesTransaction = Prisma.TransactionClient;
type SalesPrismaClient = Pick<PrismaClient, "$transaction">;

export interface SaleSelectionInput {
  inventoryPositionId: string;
  quantity: number;
  comment?: string;
}

export interface SaleInventorySnapshot {
  id: string;
  organizationId: string;
  productId: string;
  productName: string;
  variant?: string | null;
  size?: string | null;
  inventoryType: InventoryType;
  inventoryNumber: string;
  quantityAvailable: number;
  receivedAt: Date;
  unitCostNetCents: number;
  consignmentPartner?: string | null;
  consignmentSettlementCents?: number | null;
}

export interface SaleAllocationPlan {
  inventoryPositionId: string;
  inventoryNumber: string;
  quantity: number;
  unitCostNetCents: number;
  inventoryType: InventoryType;
  consignmentSettlementCents?: number | null;
}

export interface SaleLinePlan {
  productId: string;
  descriptionSnapshot: string;
  variantSnapshot?: string | null;
  sizeSnapshot?: string | null;
  quantity: number;
  comment?: string;
  allocations: SaleAllocationPlan[];
  grossAmountCents: number;
  netAmountCents: number;
  unitGrossPriceCents: number;
}

export interface CreateInventorySaleInput {
  organizationId: string;
  createdById: string;
  platformId: string;
  soldAt: Date;
  selections: SaleSelectionInput[];
  saleGrossCents: number;
  taxRatePercent: number;
  buyerCountry: string;
  shippingMethod?: string | null;
  shippingCostCents: number;
  platformFeeGrossCents: number;
  platformFeeNetCents: number;
  feeInclVat: boolean;
  payoutRecipient?: string | null;
  status: "PENDING" | "COMPLETED" | "PAID" | "SHIPPED";
  invoiceCreated: boolean;
  notes?: string | null;
  debt?: {
    create: boolean;
    description: string;
    debtorName: string;
    creditorName: string;
  };
  tx?: SalesTransaction;
  prisma?: SalesPrismaClient;
}

export interface CreateInventorySaleResult {
  sale: Sale;
  saleLines: Array<SaleLine & { allocations: SaleLineAllocation[] }>;
}

export class SalesDomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_SELECTION"
      | "POSITION_NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "SALE_NOT_FOUND"
      | "SALE_HAS_RETURNS"
      | "LEGACY_SALE_NOT_SUPPORTED",
    message: string
  ) {
    super(message);
    this.name = "SalesDomainError";
  }
}

export function planSaleAllocationsFromSnapshots(input: {
  organizationId: string;
  selections: SaleSelectionInput[];
  candidates: SaleInventorySnapshot[];
  saleGrossCents: number;
  saleNetCents: number;
}): SaleLinePlan[] {
  if (input.selections.length === 0) {
    throw new SalesDomainError("INVALID_SELECTION", "Mindestens eine Verkaufsposition ist erforderlich.");
  }

  const byId = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));
  const ownedNeeds = new Map<string, { quantity: number; source: SaleInventorySnapshot; comments: string[] }>();
  const lines: SaleLinePlan[] = [];

  for (const selection of input.selections) {
    const quantity = normalizeQuantity(selection.quantity);
    const selected = byId.get(selection.inventoryPositionId);
    if (!selected || selected.organizationId !== input.organizationId) {
      throw new SalesDomainError("POSITION_NOT_FOUND", "Bestandsposition wurde im Mandanten nicht gefunden.");
    }

    if (selected.inventoryType === "CONSIGNMENT") {
      if (quantity > selected.quantityAvailable) {
        throw new SalesDomainError(
          "INSUFFICIENT_STOCK",
          `${selected.inventoryNumber} hat nur ${selected.quantityAvailable} Stück verfügbar.`
        );
      }
      lines.push(buildLineFromAllocations(selected, selection.comment, [
        {
          inventoryPositionId: selected.id,
          inventoryNumber: selected.inventoryNumber,
          quantity,
          unitCostNetCents: selected.unitCostNetCents,
          inventoryType: selected.inventoryType,
          consignmentSettlementCents: selected.consignmentSettlementCents,
        },
      ]));
      continue;
    }

    const existing = ownedNeeds.get(selected.productId);
    if (existing) {
      existing.quantity += quantity;
      if (selection.comment) existing.comments.push(selection.comment);
    } else {
      ownedNeeds.set(selected.productId, {
        quantity,
        source: selected,
        comments: selection.comment ? [selection.comment] : [],
      });
    }
  }

  for (const [productId, need] of ownedNeeds) {
    const allocations: SaleAllocationPlan[] = [];
    let remaining = need.quantity;
    const candidates = input.candidates
      .filter(
        (candidate) =>
          candidate.organizationId === input.organizationId &&
          candidate.inventoryType === "OWNED" &&
          candidate.productId === productId &&
          candidate.quantityAvailable > 0
      )
      .sort(
        (left, right) =>
          left.receivedAt.getTime() - right.receivedAt.getTime() ||
          left.inventoryNumber.localeCompare(right.inventoryNumber)
      );

    for (const candidate of candidates) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, candidate.quantityAvailable);
      allocations.push({
        inventoryPositionId: candidate.id,
        inventoryNumber: candidate.inventoryNumber,
        quantity,
        unitCostNetCents: candidate.unitCostNetCents,
        inventoryType: "OWNED",
      });
      remaining -= quantity;
    }

    if (remaining > 0) {
      throw new SalesDomainError(
        "INSUFFICIENT_STOCK",
        `${need.source.productName} hat nicht genug verfügbaren Eigenbestand.`
      );
    }

    lines.push(
      buildLineFromAllocations(need.source, need.comments.join(" · ") || undefined, allocations)
    );
  }

  return assignLineAmounts(lines, input.saleGrossCents, input.saleNetCents);
}

export function salePlanCostNetCents(lines: SaleLinePlan[]): number {
  return lines.reduce(
    (sum, line) =>
      sum +
      line.allocations.reduce(
        (lineSum, allocation) =>
          lineSum + allocation.quantity * allocation.unitCostNetCents,
        0
      ),
    0
  );
}

export async function createInventorySale(
  input: CreateInventorySaleInput
): Promise<CreateInventorySaleResult> {
  if (input.tx) return createInventorySaleInTransaction(input.tx, input);

  const client = input.prisma ?? defaultPrisma;
  return client.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${input.organizationId}, TRUE)`;
    return createInventorySaleInTransaction(tx, input);
  });
}

export async function cancelInventorySale(input: {
  organizationId: string;
  saleId: string;
  createdById: string;
  comment?: string;
  tx?: SalesTransaction;
  prisma?: SalesPrismaClient;
}): Promise<{ sale: Sale; alreadyCancelled: boolean }> {
  if (input.tx) return cancelInventorySaleInTransaction(input.tx, input);

  const client = input.prisma ?? defaultPrisma;
  return client.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${input.organizationId}, TRUE)`;
    return cancelInventorySaleInTransaction(tx, input);
  });
}

async function createInventorySaleInTransaction(
  tx: SalesTransaction,
  input: CreateInventorySaleInput
): Promise<CreateInventorySaleResult> {
  const candidates = await loadSaleCandidates(tx, input.organizationId, input.selections);
  const preliminaryNet = grossToNetCents(input.saleGrossCents, input.taxRatePercent);
  const lines = planSaleAllocationsFromSnapshots({
    organizationId: input.organizationId,
    selections: input.selections,
    candidates,
    saleGrossCents: input.saleGrossCents,
    saleNetCents: preliminaryNet,
  });
  const purchaseNetCents = salePlanCostNetCents(lines);
  const calc = calcSale({
    saleGrossCents: input.saleGrossCents,
    taxRatePercent: input.taxRatePercent,
    purchaseNetCents,
    shippingCostCents: input.shippingCostCents,
    platformFeeCents: input.platformFeeNetCents,
    paymentFeeCents: 0,
  });
  const linesWithAmounts = assignLineAmounts(
    lines,
    input.saleGrossCents,
    calc.saleNetCents
  );

  const saleNumber = (
    await reserveDocumentNumber(input.organizationId, "SALE", {
      tx,
      reference: input.soldAt,
    })
  ).display;

  const sale = await tx.sale.create({
    data: {
      organizationId: input.organizationId,
      platformId: input.platformId,
      soldAt: input.soldAt,
      quantity: linesWithAmounts.reduce((sum, line) => sum + line.quantity, 0),
      salePriceCents: input.saleGrossCents,
      saleNetCents: calc.saleNetCents,
      taxRatePercent: input.taxRatePercent,
      marginCents: calc.marginCents,
      profitCents: calc.profitCents,
      buyerCountry: input.buyerCountry,
      shippingMethod: input.shippingMethod || null,
      shippingCostCents: input.shippingCostCents,
      platformFeeCents: input.platformFeeGrossCents,
      platformFeeNetCents: input.platformFeeNetCents,
      feeInclVat: input.feeInclVat,
      payoutRecipient: input.payoutRecipient || null,
      status: input.status,
      invoiceCreated: input.invoiceCreated,
      notes: input.notes || null,
      orderNumber: saleNumber,
    },
  });

  const createdLines: Array<SaleLine & { allocations: SaleLineAllocation[] }> = [];
  for (const line of linesWithAmounts) {
    const saleLine = await tx.saleLine.create({
      data: {
        organizationId: input.organizationId,
        saleId: sale.id,
        productId: line.productId,
        descriptionSnapshot: line.descriptionSnapshot,
        variantSnapshot: line.variantSnapshot,
        sizeSnapshot: line.sizeSnapshot,
        quantity: line.quantity,
        unitGrossPrice: centsToDecimalString(line.unitGrossPriceCents),
        grossAmount: centsToDecimalString(line.grossAmountCents),
        netAmount: centsToDecimalString(line.netAmountCents),
        comment: line.comment,
      },
    });

    const allocations: SaleLineAllocation[] = [];
    for (const allocation of line.allocations) {
      const createdAllocation = await tx.saleLineAllocation.create({
        data: {
          organizationId: input.organizationId,
          saleLineId: saleLine.id,
          inventoryPositionId: allocation.inventoryPositionId,
          quantity: allocation.quantity,
          unitCostNetSnapshot: centsToDecimalString(allocation.unitCostNetCents),
          inventoryTypeSnapshot: allocation.inventoryType,
          consignmentSettlementSnapshot:
            allocation.consignmentSettlementCents == null
              ? undefined
              : centsToDecimalString(allocation.consignmentSettlementCents),
        },
      });

      await sell({
        organizationId: input.organizationId,
        inventoryPositionId: allocation.inventoryPositionId,
        quantity: allocation.quantity,
        referenceType: "SaleLineAllocation",
        referenceId: createdAllocation.id,
        referenceAction: "sale_out",
        idempotencyKey: `sale:${sale.id}:allocation:${createdAllocation.id}:sale-out`,
        comment: `Verkauf ${saleNumber}`,
        createdById: input.createdById,
        requiredInventoryType: allocation.inventoryType,
        tx,
      });
      allocations.push(createdAllocation);
    }

    createdLines.push({ ...saleLine, allocations });
  }

  if (input.debt?.create) {
    await tx.debt.create({
      data: {
        organizationId: input.organizationId,
        debtDate: input.soldAt,
        refId: saleNumber,
        description: input.debt.description,
        kind: "VERKAUF",
        quantity: sale.quantity,
        amountCents: input.saleGrossCents,
        debtorName: input.debt.debtorName,
        creditorName: input.debt.creditorName,
        status: "OPEN",
        entryStatus: "IO",
      },
    });
  }

  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.createdById,
      action: "sale.create_v2",
      entityType: "Sale",
      entityId: sale.id,
      after: {
        saleNumber,
        lineCount: createdLines.length,
        quantity: sale.quantity,
        saleGrossCents: input.saleGrossCents,
        purchaseNetCents,
      },
    },
  });

  return { sale, saleLines: createdLines };
}

async function cancelInventorySaleInTransaction(
  tx: SalesTransaction,
  input: {
    organizationId: string;
    saleId: string;
    createdById: string;
    comment?: string;
  }
): Promise<{ sale: Sale; alreadyCancelled: boolean }> {
  const sale = await tx.sale.findFirst({
    where: { id: input.saleId, organizationId: input.organizationId },
    include: {
      returns: { select: { id: true } },
      saleLines: {
        include: {
          allocations: true,
        },
      },
    },
  });
  if (!sale) {
    throw new SalesDomainError("SALE_NOT_FOUND", "Verkauf wurde nicht gefunden.");
  }
  if (sale.status === "CANCELLED") {
    return { sale, alreadyCancelled: true };
  }
  if (sale.returns.length > 0) {
    throw new SalesDomainError(
      "SALE_HAS_RETURNS",
      "Verkauf mit Retouren kann nicht direkt storniert werden."
    );
  }
  if (sale.saleLines.length === 0) {
    throw new SalesDomainError(
      "LEGACY_SALE_NOT_SUPPORTED",
      "Legacy-Verkäufe ohne SaleLines können nicht automatisch storniert werden."
    );
  }

  for (const line of sale.saleLines) {
    for (const allocation of line.allocations) {
      const movement = await tx.inventoryMovement.findFirst({
        where: {
          organizationId: input.organizationId,
          referenceType: "SaleLineAllocation",
          referenceId: allocation.id,
          movementType: "SALE_OUT",
        },
      });
      if (!movement) continue;
      await reverseMovement({
        organizationId: input.organizationId,
        movementId: movement.id,
        idempotencyKey: `sale:${sale.id}:allocation:${allocation.id}:cancel`,
        comment: input.comment ?? `Storno ${sale.orderNumber ?? sale.id}`,
        createdById: input.createdById,
        tx,
      });
    }
  }

  const updated = await tx.sale.update({
    where: { id: sale.id },
    data: { status: "CANCELLED" },
  });

  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.createdById,
      action: "sale.cancel_v2",
      entityType: "Sale",
      entityId: sale.id,
      before: { status: sale.status },
      after: { status: "CANCELLED", orderNumber: sale.orderNumber },
    },
  });

  return { sale: updated, alreadyCancelled: false };
}

async function loadSaleCandidates(
  tx: SalesTransaction,
  organizationId: string,
  selections: SaleSelectionInput[]
): Promise<SaleInventorySnapshot[]> {
  const selectedIds = [...new Set(selections.map((selection) => selection.inventoryPositionId))];
  const selected = await tx.inventoryPosition.findMany({
    where: {
      id: { in: selectedIds },
      organizationId,
      active: true,
    },
    include: {
      product: true,
      ownedLot: true,
      consignmentLot: true,
    },
  });

  if (selected.length !== selectedIds.length) {
    throw new SalesDomainError("POSITION_NOT_FOUND", "Mindestens eine Bestandsposition ist ungültig.");
  }

  const ownedProductIds = [
    ...new Set(
      selected
        .filter((position) => position.inventoryType === "OWNED")
        .map((position) => position.productId)
    ),
  ];

  const ownedCandidates = ownedProductIds.length
    ? await tx.inventoryPosition.findMany({
        where: {
          organizationId,
          active: true,
          inventoryType: "OWNED",
          productId: { in: ownedProductIds },
          quantityAvailable: { gt: 0 },
        },
        include: {
          product: true,
          ownedLot: true,
          consignmentLot: true,
        },
        orderBy: [{ receivedAt: "asc" }, { inventoryNumber: "asc" }],
      })
    : [];

  const combined = new Map(
    [...selected, ...ownedCandidates].map((position) => [
      position.id,
      toSnapshot(position),
    ])
  );
  return [...combined.values()];
}

function toSnapshot(position: Prisma.InventoryPositionGetPayload<{
  include: { product: true; ownedLot: true; consignmentLot: true };
}>): SaleInventorySnapshot {
  const consignmentSettlementCents = decimalToCents(
    position.consignmentLot?.settlementAmount ??
      position.consignmentLot?.costNet ??
      position.consignmentLot?.costGross ??
      null
  );
  const unitCostNetCents =
    position.inventoryType === "OWNED"
      ? decimalToCents(position.ownedLot?.unitPriceNet ?? null) ?? 0
      : consignmentSettlementCents ?? 0;

  return {
    id: position.id,
    organizationId: position.organizationId,
    productId: position.productId,
    productName: position.product.name,
    variant: position.product.variant,
    size: position.product.size,
    inventoryType: position.inventoryType,
    inventoryNumber: position.inventoryNumber,
    quantityAvailable: position.quantityAvailable,
    receivedAt: position.receivedAt,
    unitCostNetCents,
    consignmentPartner: position.consignmentLot?.partnerCompany ?? null,
    consignmentSettlementCents,
  };
}

function buildLineFromAllocations(
  source: SaleInventorySnapshot,
  comment: string | undefined,
  allocations: SaleAllocationPlan[]
): SaleLinePlan {
  return {
    productId: source.productId,
    descriptionSnapshot: source.productName,
    variantSnapshot: source.variant,
    sizeSnapshot: source.size,
    quantity: allocations.reduce((sum, allocation) => sum + allocation.quantity, 0),
    comment,
    allocations,
    grossAmountCents: 0,
    netAmountCents: 0,
    unitGrossPriceCents: 0,
  };
}

function assignLineAmounts(
  lines: SaleLinePlan[],
  saleGrossCents: number,
  saleNetCents: number
): SaleLinePlan[] {
  const quantities = lines.map((line) => line.quantity);
  const grossParts = splitCents(saleGrossCents, quantities);
  const netParts = splitCents(saleNetCents, quantities);
  return lines.map((line, index) => ({
    ...line,
    grossAmountCents: grossParts[index] ?? 0,
    netAmountCents: netParts[index] ?? 0,
    unitGrossPriceCents: Math.round((grossParts[index] ?? 0) / line.quantity),
  }));
}

function splitCents(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return total - allocated;
    const part = Math.round((total * weight) / weightSum);
    allocated += part;
    return part;
  });
}

function normalizeQuantity(value: number): number {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new SalesDomainError("INVALID_SELECTION", "Menge muss mindestens 1 sein.");
  }
  return quantity;
}

function decimalToCents(value: unknown): number | null {
  if (value == null) return null;
  return Math.round(Number(value) * 100);
}
