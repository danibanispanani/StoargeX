import type {
  EntryStatus,
  InventoryPosition,
  Prisma,
  PrismaClient,
  Product,
  Purchase,
  PurchaseLine,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { calcPurchaseNetCents } from "@/lib/calculations";
import { reserveDocumentNumber } from "@/lib/services/document-number-service";
import { receiveOwnedStock } from "@/lib/services/inventory-service";

type PurchaseTransaction = Prisma.TransactionClient;
type PurchasePrismaClient = Pick<PrismaClient, "$transaction">;

export interface OwnedPurchaseLineInput {
  productId?: string;
  productName: string;
  variant?: string;
  size?: string;
  ean?: string;
  category?: string;
  quantity: number;
  unitPriceGrossCents: number;
  inputTaxDeductible: boolean;
  inputTaxRatePercent: number;
  purchaseEntryStatus: EntryStatus;
  returnEntryStatus: EntryStatus;
  platformIds?: string[];
  imageUrls?: string[];
  comment?: string;
}

export interface CreateOwnedPurchaseInput {
  organizationId: string;
  createdById: string;
  purchaseDate: Date;
  vendor: string;
  paymentMethod: string;
  comment?: string;
  lines: OwnedPurchaseLineInput[];
  tx?: PurchaseTransaction;
  prisma?: PurchasePrismaClient;
}

export interface OwnedPurchaseLinePlan extends OwnedPurchaseLineInput {
  unitPriceNetCents: number;
  totalGrossCents: number;
  totalNetCents: number;
}

export interface CreatedOwnedPurchaseLine {
  product: Product;
  purchaseLine: PurchaseLine;
  inventoryPosition: InventoryPosition;
  inventoryNumber: string;
}

export interface CreateOwnedPurchaseResult {
  purchase: Purchase;
  purchaseNumber: string;
  lines: CreatedOwnedPurchaseLine[];
}

export type DerivedOwnedStockStatus =
  | "Verfügbar"
  | "Teilverkauft"
  | "Ausverkauft"
  | "In Prüfung"
  | "Defekt";

export function prepareOwnedPurchaseLines(
  lines: OwnedPurchaseLineInput[]
): OwnedPurchaseLinePlan[] {
  if (lines.length === 0) {
    throw new Error("Mindestens eine Einkaufsposition ist erforderlich.");
  }

  return lines.map((line, index) => {
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Position ${index + 1}: Menge muss mindestens 1 sein.`);
    }
    if (!line.productName.trim() && !line.productId) {
      throw new Error(`Position ${index + 1}: Produkt fehlt.`);
    }
    if (!Number.isInteger(line.unitPriceGrossCents) || line.unitPriceGrossCents < 0) {
      throw new Error(`Position ${index + 1}: Brutto-EK ist ungültig.`);
    }

    const unitPriceNetCents = calcPurchaseNetCents(
      line.unitPriceGrossCents,
      line.inputTaxDeductible,
      line.inputTaxRatePercent
    );

    return {
      ...line,
      productName: line.productName.trim(),
      variant: normalizeOptional(line.variant) ?? undefined,
      size: normalizeOptional(line.size) ?? undefined,
      ean: normalizeOptional(line.ean) ?? undefined,
      category: normalizeOptional(line.category) ?? undefined,
      platformIds: line.platformIds ?? [],
      imageUrls: line.imageUrls ?? [],
      quantity,
      unitPriceNetCents,
      totalGrossCents: line.unitPriceGrossCents * quantity,
      totalNetCents: unitPriceNetCents * quantity,
    };
  });
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function deriveOwnedStockStatus(input: {
  quantityAvailable: number;
  quantityReceived: number;
  quantityInspection: number;
  quantityDefective: number;
}): DerivedOwnedStockStatus {
  if (input.quantityInspection > 0) return "In Prüfung";
  if (input.quantityAvailable <= 0 && input.quantityDefective > 0) return "Defekt";
  if (input.quantityAvailable <= 0) return "Ausverkauft";
  if (input.quantityAvailable < input.quantityReceived) return "Teilverkauft";
  return "Verfügbar";
}

export async function createOwnedPurchase(
  input: CreateOwnedPurchaseInput
): Promise<CreateOwnedPurchaseResult> {
  const plans = prepareOwnedPurchaseLines(input.lines);

  if (input.tx) {
    return createOwnedPurchaseInTransaction(input.tx, input, plans);
  }

  const client = input.prisma ?? defaultPrisma;
  return client.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${input.organizationId}, TRUE)`;
    return createOwnedPurchaseInTransaction(tx, input, plans);
  });
}

async function createOwnedPurchaseInTransaction(
  tx: PurchaseTransaction,
  input: CreateOwnedPurchaseInput,
  plans: OwnedPurchaseLinePlan[]
): Promise<CreateOwnedPurchaseResult> {
  const purchaseNumber = (
    await reserveDocumentNumber(input.organizationId, "PURCHASE", {
      tx,
      reference: input.purchaseDate,
    })
  ).display;

  const purchase = await tx.purchase.create({
    data: {
      organizationId: input.organizationId,
      purchaseNumber,
      purchaseDate: input.purchaseDate,
      vendor: input.vendor,
      paymentMethod: input.paymentMethod,
      purchaseStatus: "CONFIRMED",
      comment: normalizeOptional(input.comment),
      createdById: input.createdById,
    },
  });

  const createdLines: CreatedOwnedPurchaseLine[] = [];

  for (const [index, line] of plans.entries()) {
    const product = await resolveProduct(tx, input.organizationId, line);
    const purchaseLine = await tx.purchaseLine.create({
      data: {
        organizationId: input.organizationId,
        purchaseId: purchase.id,
        productId: product.id,
        quantity: line.quantity,
        unitPriceGross: centsToDecimalString(line.unitPriceGrossCents),
        unitPriceNet: centsToDecimalString(line.unitPriceNetCents),
        vatDeductible: line.inputTaxDeductible,
        totalGross: centsToDecimalString(line.totalGrossCents),
        totalNet: centsToDecimalString(line.totalNetCents),
        comment: normalizeOptional(line.comment),
      },
    });

    const inventoryNumber = (
      await reserveDocumentNumber(input.organizationId, "OWNED_STOCK", {
        tx,
        reference: input.purchaseDate,
      })
    ).display;

    const inventoryPosition = await tx.inventoryPosition.create({
      data: {
        organizationId: input.organizationId,
        productId: product.id,
        inventoryType: "OWNED",
        inventoryNumber,
        quantityReceived: 0,
        quantityAvailable: 0,
        quantityReserved: 0,
        quantityInspection: 0,
        quantityDefective: 0,
        quantitySold: 0,
        receivedAt: input.purchaseDate,
      },
    });

    await tx.ownedStockLot.create({
      data: {
        organizationId: input.organizationId,
        inventoryPositionId: inventoryPosition.id,
        purchaseLineId: purchaseLine.id,
        purchaseDate: input.purchaseDate,
        vendor: input.vendor,
        unitPriceGross: centsToDecimalString(line.unitPriceGrossCents),
        unitPriceNet: centsToDecimalString(line.unitPriceNetCents),
        vatDeductible: line.inputTaxDeductible,
        paymentMethod: input.paymentMethod,
        purchaseEntryStatus: line.purchaseEntryStatus,
        returnEntryStatus: line.returnEntryStatus,
        ean: line.ean,
        imageUrls: line.imageUrls ?? [],
      },
    });

    if (line.platformIds && line.platformIds.length > 0) {
      await tx.inventoryPositionListing.createMany({
        data: line.platformIds.map((platformId) => ({
          organizationId: input.organizationId,
          inventoryPositionId: inventoryPosition.id,
          platformId,
        })),
        skipDuplicates: true,
      });
    }

    const receipt = await receiveOwnedStock({
      organizationId: input.organizationId,
      inventoryPositionId: inventoryPosition.id,
      quantity: line.quantity,
      referenceType: "PurchaseLine",
      referenceId: purchaseLine.id,
      referenceAction: "purchase_receipt",
      idempotencyKey: `purchase:${purchase.id}:line:${purchaseLine.id}:receipt`,
      comment: normalizeOptional(line.comment) ?? `Wareneingang ${purchaseNumber}`,
      createdById: input.createdById,
      tx,
    });

    createdLines.push({
      product,
      purchaseLine,
      inventoryPosition: receipt.position,
      inventoryNumber,
    });

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.createdById,
        action: "owned_stock_lot.create",
        entityType: "InventoryPosition",
        entityId: inventoryPosition.id,
        after: {
          purchaseNumber,
          line: index + 1,
          inventoryNumber,
          productName: product.name,
          quantity: line.quantity,
          unitPriceGrossCents: line.unitPriceGrossCents,
        },
      },
    });
  }

  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.createdById,
      action: "purchase.create",
      entityType: "Purchase",
      entityId: purchase.id,
      after: {
        purchaseNumber,
        vendor: input.vendor,
        lineCount: plans.length,
        quantity: plans.reduce((sum, line) => sum + line.quantity, 0),
      },
    },
  });

  return { purchase, purchaseNumber, lines: createdLines };
}

async function resolveProduct(
  tx: PurchaseTransaction,
  organizationId: string,
  line: OwnedPurchaseLinePlan
): Promise<Product> {
  if (line.productId) {
    const product = await tx.product.findFirst({
      where: { id: line.productId, organizationId },
    });
    if (!product) throw new Error("Produkt wurde im Mandanten nicht gefunden.");
    return product;
  }

  const existing = await tx.product.findFirst({
    where: {
      organizationId,
      name: line.productName,
      variant: line.variant ?? null,
    },
  });
  if (existing) return existing;

  return tx.product.create({
    data: {
      organizationId,
      name: line.productName,
      variant: line.variant ?? null,
      size: line.size ?? null,
      ean: line.ean ?? null,
      category: line.category ?? null,
      defaultPriceCents: line.unitPriceGrossCents,
    },
  });
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
