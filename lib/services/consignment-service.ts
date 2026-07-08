import type {
  ConsignmentLot,
  InventoryPosition,
  Prisma,
  PrismaClient,
  Product,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { reserveDocumentNumber } from "@/lib/services/document-number-service";
import {
  applyInventoryMovement,
  receiveConsignmentStock,
  sell,
} from "@/lib/services/inventory-service";
import { centsToDecimalString } from "@/lib/services/owned-purchase-service";

type ConsignmentTransaction = Prisma.TransactionClient;
type ConsignmentPrismaClient = Pick<PrismaClient, "$transaction">;

export interface ChannelPriceInput {
  label: string;
  cents: number;
}

export interface CreateConsignmentStockInput {
  organizationId: string;
  createdById: string;
  partnerCompany: string;
  externalSku?: string;
  productId?: string;
  productName: string;
  variant?: string;
  ean?: string;
  identificationNumber?: string;
  category?: string;
  quantityReceived: number;
  quantityAvailable?: number;
  quantitySold?: number;
  quantityInspection?: number;
  quantityDefective?: number;
  costGrossCents?: number | null;
  costNetCents?: number | null;
  settlementAmountCents?: number | null;
  shippingCostCents?: number | null;
  realRrpGrossCents?: number | null;
  channelPrices?: ChannelPriceInput[];
  comment?: string;
  receivedAt?: Date;
  tx?: ConsignmentTransaction;
  prisma?: ConsignmentPrismaClient;
}

export interface ConsignmentStockPlan
  extends Omit<
    CreateConsignmentStockInput,
    "tx" | "prisma" | "quantityAvailable" | "quantitySold" | "quantityInspection" | "quantityDefective"
  > {
  quantityAvailable: number;
  quantitySold: number;
  quantityInspection: number;
  quantityDefective: number;
  receivedAt: Date;
  channelPrices: ChannelPriceInput[];
}

export interface CreateConsignmentStockResult {
  product: Product;
  inventoryPosition: InventoryPosition;
  consignmentLot: ConsignmentLot;
  inventoryNumber: string;
}

export type DerivedConsignmentStockStatus =
  | "Verfügbar"
  | "Teilverkauft"
  | "Ausverkauft"
  | "In Prüfung"
  | "Defekt";

export function prepareConsignmentStock(
  input: CreateConsignmentStockInput
): ConsignmentStockPlan {
  const quantityReceived = toNonNegativeInteger(
    input.quantityReceived,
    "Erhaltene Menge"
  );
  if (quantityReceived < 1) {
    throw new Error("Erhaltene Menge muss mindestens 1 sein.");
  }

  if (!input.partnerCompany.trim()) {
    throw new Error("Partnerfirma fehlt.");
  }
  if (!input.productName.trim() && !input.productId) {
    throw new Error("Artikelname fehlt.");
  }

  const quantitySold = toNonNegativeInteger(
    input.quantitySold ?? 0,
    "Verkaufte Menge"
  );
  const quantityInspection = toNonNegativeInteger(
    input.quantityInspection ?? 0,
    "Retouren-/Prüfmenge"
  );
  const quantityDefective = toNonNegativeInteger(
    input.quantityDefective ?? 0,
    "Defektmenge"
  );
  const quantityAvailable =
    input.quantityAvailable == null
      ? quantityReceived - quantitySold - quantityInspection - quantityDefective
      : toNonNegativeInteger(input.quantityAvailable, "Verfügbare Menge");

  const distributed =
    quantityAvailable + quantitySold + quantityInspection + quantityDefective;
  if (distributed !== quantityReceived) {
    throw new Error(
      "Verfügbar + verkauft + Retoure/Prüfung + defekt muss der erhaltenen Menge entsprechen."
    );
  }

  return {
    ...input,
    partnerCompany: input.partnerCompany.trim(),
    externalSku: normalizeOptional(input.externalSku) ?? undefined,
    productName: input.productName.trim(),
    variant: normalizeOptional(input.variant) ?? undefined,
    ean: normalizeOptional(input.ean) ?? undefined,
    identificationNumber:
      normalizeOptional(input.identificationNumber) ?? undefined,
    category: normalizeOptional(input.category) ?? undefined,
    comment: normalizeOptional(input.comment) ?? undefined,
    quantityReceived,
    quantityAvailable,
    quantitySold,
    quantityInspection,
    quantityDefective,
    channelPrices: input.channelPrices ?? [],
    receivedAt: input.receivedAt ?? new Date(),
  };
}

export function deriveConsignmentStockStatus(input: {
  quantityAvailable: number;
  quantityReceived: number;
  quantityInspection: number;
  quantityDefective: number;
}): DerivedConsignmentStockStatus {
  if (input.quantityInspection > 0) return "In Prüfung";
  if (input.quantityAvailable <= 0 && input.quantityDefective > 0) return "Defekt";
  if (input.quantityAvailable <= 0) return "Ausverkauft";
  if (input.quantityAvailable < input.quantityReceived) return "Teilverkauft";
  return "Verfügbar";
}

export async function createConsignmentStock(
  input: CreateConsignmentStockInput
): Promise<CreateConsignmentStockResult> {
  const plan = prepareConsignmentStock(input);

  if (input.tx) return createConsignmentStockInTransaction(input.tx, plan);

  const client = input.prisma ?? defaultPrisma;
  return client.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${input.organizationId}, TRUE)`;
    return createConsignmentStockInTransaction(tx, plan);
  });
}

async function createConsignmentStockInTransaction(
  tx: ConsignmentTransaction,
  plan: ConsignmentStockPlan
): Promise<CreateConsignmentStockResult> {
  const product = await resolveProduct(tx, plan);
  const inventoryNumber = (
    await reserveDocumentNumber(plan.organizationId, "CONSIGNMENT", {
      tx,
      reference: plan.receivedAt,
    })
  ).display;

  const inventoryPosition = await tx.inventoryPosition.create({
    data: {
      organizationId: plan.organizationId,
      productId: product.id,
      inventoryType: "CONSIGNMENT",
      inventoryNumber,
      quantityReceived: 0,
      quantityAvailable: 0,
      quantityReserved: 0,
      quantityInspection: 0,
      quantityDefective: 0,
      quantitySold: 0,
      receivedAt: plan.receivedAt,
    },
  });

  const consignmentLot = await tx.consignmentLot.create({
    data: {
      organizationId: plan.organizationId,
      inventoryPositionId: inventoryPosition.id,
      partnerCompany: plan.partnerCompany,
      externalSku: plan.externalSku,
      identificationNumber: plan.identificationNumber,
      costGross: optionalDecimal(plan.costGrossCents),
      costNet: optionalDecimal(plan.costNetCents ?? plan.costGrossCents),
      settlementAmount: optionalDecimal(plan.settlementAmountCents),
      shippingCost: optionalDecimal(plan.shippingCostCents),
      realRrpGross: optionalDecimal(plan.realRrpGrossCents),
      channelPrices: plan.channelPrices as unknown as Prisma.InputJsonValue,
      comment: plan.comment,
    },
  });

  const receipt = await receiveConsignmentStock({
    organizationId: plan.organizationId,
    inventoryPositionId: inventoryPosition.id,
    quantity: plan.quantityReceived,
    referenceType: "ConsignmentLot",
    referenceId: consignmentLot.id,
    referenceAction: "consignment_receipt",
    idempotencyKey: `consignment:${consignmentLot.id}:receipt`,
    comment: plan.comment ?? `Konsignationszugang ${inventoryNumber}`,
    createdById: plan.createdById,
    tx,
  });

  if (plan.quantitySold > 0) {
    await sell({
      organizationId: plan.organizationId,
      inventoryPositionId: inventoryPosition.id,
      quantity: plan.quantitySold,
      referenceType: "ConsignmentLot",
      referenceId: consignmentLot.id,
      referenceAction: "initial_sold_snapshot",
      idempotencyKey: `consignment:${consignmentLot.id}:initial-sold`,
      comment: "Initial übernommene verkaufte Konsignationsmenge",
      createdById: plan.createdById,
      requiredInventoryType: "CONSIGNMENT",
      tx,
    });
  }

  if (plan.quantityInspection > 0) {
    await applyInventoryMovement({
      organizationId: plan.organizationId,
      inventoryPositionId: inventoryPosition.id,
      movementType: "ADJUSTMENT_OUT",
      quantity: plan.quantityInspection,
      fromBucket: "AVAILABLE",
      toBucket: "INSPECTION",
      referenceType: "ConsignmentLot",
      referenceId: consignmentLot.id,
      referenceAction: "initial_inspection_snapshot",
      idempotencyKey: `consignment:${consignmentLot.id}:initial-inspection`,
      comment: "Initial übernommene Retouren-/Prüfmenge",
      createdById: plan.createdById,
      requiredInventoryType: "CONSIGNMENT",
      counterDeltas: {},
      tx,
    });
  }

  if (plan.quantityDefective > 0) {
    await applyInventoryMovement({
      organizationId: plan.organizationId,
      inventoryPositionId: inventoryPosition.id,
      movementType: "ADJUSTMENT_OUT",
      quantity: plan.quantityDefective,
      fromBucket: "AVAILABLE",
      toBucket: "DEFECTIVE",
      referenceType: "ConsignmentLot",
      referenceId: consignmentLot.id,
      referenceAction: "initial_defective_snapshot",
      idempotencyKey: `consignment:${consignmentLot.id}:initial-defective`,
      comment: "Initial übernommene defekte Konsignationsmenge",
      createdById: plan.createdById,
      requiredInventoryType: "CONSIGNMENT",
      counterDeltas: {},
      tx,
    });
  }

  const positionAfter = await tx.inventoryPosition.findUniqueOrThrow({
    where: { id: inventoryPosition.id },
  });

  await tx.auditLog.create({
    data: {
      organizationId: plan.organizationId,
      userId: plan.createdById,
      action: "consignment_lot.create",
      entityType: "InventoryPosition",
      entityId: inventoryPosition.id,
      after: {
        inventoryNumber,
        partnerCompany: plan.partnerCompany,
        productName: product.name,
        quantityReceived: plan.quantityReceived,
        quantityAvailable: plan.quantityAvailable,
      },
    },
  });

  return {
    product,
    inventoryPosition: positionAfter,
    consignmentLot,
    inventoryNumber: receipt.position.inventoryNumber,
  };
}

async function resolveProduct(
  tx: ConsignmentTransaction,
  plan: ConsignmentStockPlan
): Promise<Product> {
  if (plan.productId) {
    const product = await tx.product.findFirst({
      where: { id: plan.productId, organizationId: plan.organizationId },
    });
    if (!product) throw new Error("Produkt wurde im Mandanten nicht gefunden.");
    return product;
  }

  const existing = await tx.product.findFirst({
    where: {
      organizationId: plan.organizationId,
      name: plan.productName,
      variant: plan.variant ?? null,
    },
  });
  if (existing) return existing;

  return tx.product.create({
    data: {
      organizationId: plan.organizationId,
      name: plan.productName,
      variant: plan.variant ?? null,
      ean: plan.ean ?? null,
      category: plan.category ?? null,
      defaultPriceCents: plan.costGrossCents ?? null,
    },
  });
}

function toNonNegativeInteger(value: number, label: string): number {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new Error(`${label} muss eine ganze Zahl ≥ 0 sein.`);
  }
  return normalized;
}

function optionalDecimal(cents: number | null | undefined): string | undefined {
  return typeof cents === "number" ? centsToDecimalString(cents) : undefined;
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
