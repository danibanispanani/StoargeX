import type {
  EntryStatus,
  Debt,
  InventoryPosition,
  ItemCondition,
  PurchaseReceipt,
  ReceiptInspectionStatus,
  Prisma,
  PrismaClient,
  Product,
  Purchase,
  PurchaseLine,
  PurchaseShippingStatus,
  PurchaseStatus,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { calcPurchaseNetCents } from "@/lib/calculations";
import { DEFAULT_PURCHASE_STATUS } from "@/lib/purchases/purchase-workflow";
import { reserveDocumentNumber } from "@/lib/services/document-number-service";
import {
  InventoryDomainError,
  receiveOwnedStock,
  reverseMovementQuantity,
} from "@/lib/services/inventory-service";
import {
  ensurePurchaseDebt,
  reconcilePurchaseDebt,
  settleDebt,
} from "@/lib/services/debt-service";

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
  location?: string;
  comment?: string;
  itemCondition?: ItemCondition;
  legacyCondition?: string;
  inspectionStatus?: ReceiptInspectionStatus;
  returnDeadline?: Date;
}

export interface CreateOwnedPurchaseInput {
  organizationId: string;
  createdById: string;
  purchaseDate: Date;
  vendor: string;
  paymentMethod: string;
  businessPartnerId?: string;
  paymentAccountId?: string;
  supplierOrderNumber?: string;
  expectedDeliveryAt?: Date;
  shippingCarrier?: string;
  trackingNumber?: string;
  documentReference?: string;
  imageUrl?: string;
  saveSupplier?: boolean;
  returnDeadline?: Date;
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
  debt: Debt | null;
  receipt: PurchaseReceipt;
}

export interface CreatePurchaseOrderInput extends Omit<CreateOwnedPurchaseInput, "returnDeadline"> {
  returnDeadline?: Date;
}

export interface CreatePurchaseOrderResult {
  purchase: Purchase;
  purchaseNumber: string;
  lines: PurchaseLine[];
  debt: Debt | null;
}

export interface ReceivePurchaseLineInput {
  purchaseLineId: string;
  quantity: number;
  itemCondition?: ItemCondition;
  legacyCondition?: string;
  inspectionStatus?: ReceiptInspectionStatus;
  purchaseEntryStatus?: EntryStatus;
  returnEntryStatus?: EntryStatus;
  ean?: string;
  imageUrls?: string[];
  location?: string;
  platformIds?: string[];
  returnDeadline?: Date;
  notes?: string;
}

export interface ReceivePurchaseInput {
  organizationId: string;
  createdById: string;
  purchaseId: string;
  receivedAt: Date;
  returnWindowDays?: number;
  returnDeadline?: Date;
  shippingCarrier?: string;
  trackingNumber?: string;
  documentReference?: string;
  notes?: string;
  lines: ReceivePurchaseLineInput[];
  tx?: PurchaseTransaction;
  prisma?: PurchasePrismaClient;
}

export interface ReceivePurchaseResult {
  purchase: Purchase;
  receipt: PurchaseReceipt;
  lines: CreatedOwnedPurchaseLine[];
  complete: boolean;
}

export interface UpdatePurchaseInput {
  organizationId: string;
  createdById: string;
  purchaseId: string;
  purchaseDate: Date;
  vendor: string;
  saveSupplier?: boolean;
  paymentMethod: string;
  supplierOrderNumber?: string;
  expectedDeliveryAt?: Date;
  shippingCarrier?: string;
  trackingNumber?: string;
  purchaseStatus: Exclude<PurchaseStatus, "CANCELLED">;
  shippingStatus: PurchaseShippingStatus;
  comment?: string;
  tx?: PurchaseTransaction;
  prisma?: PurchasePrismaClient;
}

export interface UpdatePurchaseWorkflowStatusInput {
  organizationId: string;
  createdById: string;
  purchaseId: string;
  purchaseStatus?: Exclude<PurchaseStatus, "DRAFT" | "CANCELLED">;
  shippingStatus?: Exclude<PurchaseShippingStatus, "READY">;
  tx?: PurchaseTransaction;
  prisma?: PurchasePrismaClient;
}

export interface CancelPurchaseResult {
  purchase: Purchase;
  alreadyCancelled: boolean;
}

export interface CancelPurchaseReceiptResult {
  purchase: Purchase;
  alreadyCancelled: boolean;
}

export interface CancelPurchaseReceiptLineQuantityResult {
  purchase: Purchase;
  cancelledQuantity: number;
  remainingQuantity: number;
  idempotent: boolean;
}

export type DerivedOwnedStockStatus =
  | "Verfügbar"
  | "Teilverkauft"
  | "Ausverkauft"
  | "In Prüfung"
  | "Defekt";

export type ReturnDeadlineAttention = "NONE" | "ACTIVE" | "DUE_SOON" | "OVERDUE";

export interface PurchaseReceiptLinePlanInput {
  purchaseLineId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  quantity: number;
}

export interface PurchaseReceiptPlan {
  receivedAt: Date;
  returnDeadline: Date | null;
  totalQuantity: number;
  complete: boolean;
  lines: Array<PurchaseReceiptLinePlanInput & { remainingAfter: number }>;
}

export function planPurchaseReceipt(input: {
  receivedAt: Date;
  returnWindowDays?: number | null;
  explicitReturnDeadline?: Date | null;
  lines: PurchaseReceiptLinePlanInput[];
}): PurchaseReceiptPlan {
  if (input.lines.length === 0) {
    throw new Error("Mindestens eine Wareneingangsposition ist erforderlich.");
  }
  if (Number.isNaN(input.receivedAt.getTime())) {
    throw new Error("Das Eingangsdatum ist ungültig.");
  }
  if (
    input.returnWindowDays != null &&
    (!Number.isInteger(input.returnWindowDays) || input.returnWindowDays < 0)
  ) {
    throw new Error("Die Rückgabefrist in Tagen ist ungültig.");
  }

  const seen = new Set<string>();
  const lines = input.lines.map((line, index) => {
    if (!line.purchaseLineId || seen.has(line.purchaseLineId)) {
      throw new Error(`Position ${index + 1}: Bestellposition ist ungültig oder doppelt.`);
    }
    seen.add(line.purchaseLineId);
    if (!Number.isInteger(line.orderedQuantity) || line.orderedQuantity < 1) {
      throw new Error(`Position ${index + 1}: Bestellmenge ist ungültig.`);
    }
    if (!Number.isInteger(line.receivedQuantity) || line.receivedQuantity < 0) {
      throw new Error(`Position ${index + 1}: Bereits eingegangene Menge ist ungültig.`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error(`Position ${index + 1}: Eingangsmenge muss mindestens 1 sein.`);
    }
    const remainingAfter = line.orderedQuantity - line.receivedQuantity - line.quantity;
    if (remainingAfter < 0) {
      throw new Error(`Position ${index + 1}: Eingangsmenge überschreitet die offene Menge.`);
    }
    return { ...line, remainingAfter };
  });

  let returnDeadline = input.explicitReturnDeadline ?? null;
  if (returnDeadline && Number.isNaN(returnDeadline.getTime())) {
    throw new Error("Die Rückgabefrist ist ungültig.");
  }
  if (!returnDeadline && input.returnWindowDays != null) {
    returnDeadline = new Date(input.receivedAt);
    returnDeadline.setUTCDate(returnDeadline.getUTCDate() + input.returnWindowDays);
  }

  return {
    receivedAt: input.receivedAt,
    returnDeadline,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    complete: lines.every((line) => line.remainingAfter === 0),
    lines,
  };
}

export function classifyReturnDeadline(
  deadline: Date | null | undefined,
  now = new Date()
): ReturnDeadlineAttention {
  if (!deadline) return "NONE";
  const remainingMs = deadline.getTime() - now.getTime();
  if (remainingMs < 0) return "OVERDUE";
  return remainingMs <= 7 * 24 * 60 * 60 * 1000 ? "DUE_SOON" : "ACTIVE";
}

export function effectiveReceivedQuantity(input: {
  receiptQuantities: readonly number[];
  legacyLotQuantities: readonly number[];
  receiptInventoryPositionIds?: readonly string[];
  legacyLots?: ReadonlyArray<{ inventoryPositionId: string; quantity: number }>;
}): number {
  const receiptTotal = input.receiptQuantities.reduce((sum, quantity) => sum + quantity, 0);
  if (input.receiptInventoryPositionIds && input.legacyLots) {
    const receiptPositions = new Set(input.receiptInventoryPositionIds);
    const unprovenancedLegacyTotal = input.legacyLots.reduce(
      (sum, lot) => sum + (receiptPositions.has(lot.inventoryPositionId) ? 0 : lot.quantity),
      0
    );
    return receiptTotal + unprovenancedLegacyTotal;
  }
  return input.receiptQuantities.length > 0
    ? receiptTotal
    : input.legacyLotQuantities.reduce((sum, quantity) => sum + quantity, 0);
}

export function derivePurchaseProgress(lines: ReadonlyArray<{
  orderedQuantity: number;
  receivedQuantity: number;
}>): {
  purchaseStatus: Extract<PurchaseStatus, "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED">;
  shippingStatus: Extract<PurchaseShippingStatus, "NOT_SHIPPED" | "PARTIALLY_RECEIVED" | "DELIVERED">;
} {
  const received = lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
  if (received === 0) {
    return { purchaseStatus: "ORDERED", shippingStatus: "NOT_SHIPPED" };
  }
  if (lines.every((line) => line.receivedQuantity === line.orderedQuantity)) {
    return { purchaseStatus: "RECEIVED", shippingStatus: "DELIVERED" };
  }
  return {
    purchaseStatus: "PARTIALLY_RECEIVED",
    shippingStatus: "PARTIALLY_RECEIVED",
  };
}

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

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<CreatePurchaseOrderResult> {
  const plans = prepareOwnedPurchaseLines(input.lines);
  return withPurchaseTransaction(input.organizationId, input, (tx) =>
    createPurchaseOrderInTransaction(tx, input, plans)
  );
}

async function createPurchaseOrderInTransaction(
  tx: PurchaseTransaction,
  input: CreatePurchaseOrderInput,
  plans: OwnedPurchaseLinePlan[]
): Promise<CreatePurchaseOrderResult> {
  const supplier = await resolvePurchaseSupplier(tx, input.organizationId, input);
  const debtCreditorName = await validateCommercialReferences(tx, input.organizationId, input);
  const purchaseNumber = (
    await reserveDocumentNumber(input.organizationId, "PURCHASE", { tx, reference: input.purchaseDate })
  ).display;
  const purchase = await tx.purchase.create({
    data: {
      organizationId: input.organizationId,
      purchaseNumber,
      purchaseDate: input.purchaseDate,
      vendor: supplier.displayName,
      paymentMethod: input.paymentMethod,
      businessPartnerId: supplier.id,
      paymentAccountId: input.paymentAccountId,
      supplierOrderNumber: normalizeOptional(input.supplierOrderNumber),
      expectedDeliveryAt: input.expectedDeliveryAt,
      shippingCarrier: normalizeOptional(input.shippingCarrier),
      trackingNumber: normalizeOptional(input.trackingNumber),
      shippingStatus: input.trackingNumber ? "SHIPPED" : "NOT_SHIPPED",
      returnDeadline: input.returnDeadline,
      documentReference: normalizeOptional(input.documentReference),
      imageUrl: normalizeOptional(input.imageUrl),
      purchaseStatus: DEFAULT_PURCHASE_STATUS,
      comment: normalizeOptional(input.comment),
      createdById: input.createdById,
    },
  });

  const lines: PurchaseLine[] = [];
  for (const plan of plans) {
    const product = await resolveProduct(tx, input.organizationId, plan);
    lines.push(await tx.purchaseLine.create({
      data: {
        organizationId: input.organizationId,
        purchaseId: purchase.id,
        productId: product.id,
        quantity: plan.quantity,
        unitPriceGross: centsToDecimalString(plan.unitPriceGrossCents),
        unitPriceNet: centsToDecimalString(plan.unitPriceNetCents),
        vatDeductible: plan.inputTaxDeductible,
        totalGross: centsToDecimalString(plan.totalGrossCents),
        totalNet: centsToDecimalString(plan.totalNetCents),
        comment: normalizeOptional(plan.comment),
      },
    }));
  }

  const debt = await ensurePurchaseDebt({
    organizationId: input.organizationId,
    createdById: input.createdById,
    purchaseId: purchase.id,
    purchaseNumber,
    purchaseDate: input.purchaseDate,
    vendor: supplier.displayName,
    paymentMethod: input.paymentMethod,
    creditorName: debtCreditorName,
    totalGrossCents: plans.reduce((sum, line) => sum + line.totalGrossCents, 0),
    tx,
  });
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.createdById,
      action: "purchase.order.create",
      entityType: "Purchase",
      entityId: purchase.id,
      after: { purchaseNumber, lineCount: lines.length, supplier: supplier.displayName },
    },
  });
  return { purchase, purchaseNumber, lines, debt };
}

export async function receivePurchase(
  input: ReceivePurchaseInput
): Promise<ReceivePurchaseResult> {
  return withPurchaseTransaction(input.organizationId, input, (tx) =>
    receivePurchaseInTransaction(tx, input)
  );
}

async function receivePurchaseInTransaction(
  tx: PurchaseTransaction,
  input: ReceivePurchaseInput
): Promise<ReceivePurchaseResult> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:purchase-receipt:${input.organizationId}:${input.purchaseId}`}))`;
  const purchase = await tx.purchase.findFirst({
    where: { id: input.purchaseId, organizationId: input.organizationId },
    include: {
      lines: {
        include: {
          product: true,
          receiptLines: {
            select: {
              inventoryPositionId: true,
              quantity: true,
              cancelledQuantity: true,
              purchaseReceipt: { select: { cancelledAt: true } },
            },
          },
          ownedLots: {
            select: {
              inventoryPositionId: true,
              inventoryPosition: { select: { quantityReceived: true } },
            },
          },
        },
      },
    },
  });
  if (!purchase) throw new Error("Einkauf wurde im Mandanten nicht gefunden.");
  if (purchase.purchaseStatus === "CANCELLED") {
    throw new Error("Ein stornierter Einkauf kann keinen Wareneingang erhalten.");
  }

  const requestedByLine = new Map(input.lines.map((line) => [line.purchaseLineId, line]));
  if (requestedByLine.size !== input.lines.length) {
    throw new Error("Eine Bestellposition darf pro Wareneingang nur einmal vorkommen.");
  }
  const orderLines = new Map(purchase.lines.map((line) => [line.id, line]));
  for (const lineId of requestedByLine.keys()) {
    if (!orderLines.has(lineId)) {
      throw new Error("Bestellposition wurde im Einkauf dieses Mandanten nicht gefunden.");
    }
  }
  const plan = planPurchaseReceipt({
    receivedAt: input.receivedAt,
    returnWindowDays: input.returnWindowDays,
    explicitReturnDeadline: input.returnDeadline,
    lines: input.lines.map((line) => {
      const orderLine = orderLines.get(line.purchaseLineId)!;
      return {
        purchaseLineId: line.purchaseLineId,
        orderedQuantity: orderLine.quantity,
        receivedQuantity: effectiveReceivedQuantity({
          receiptQuantities: orderLine.receiptLines.map((item) =>
            item.purchaseReceipt.cancelledAt ? 0 : activeReceiptLineQuantity(item)
          ),
          legacyLotQuantities: orderLine.ownedLots.map((item) => item.inventoryPosition.quantityReceived),
          receiptInventoryPositionIds: orderLine.receiptLines.map((item) => item.inventoryPositionId),
          legacyLots: orderLine.ownedLots.map((item) => ({
            inventoryPositionId: item.inventoryPositionId,
            quantity: item.inventoryPosition.quantityReceived,
          })),
        }),
        quantity: line.quantity,
      };
    }),
  });
  const receipt = await tx.purchaseReceipt.create({
    data: {
      organizationId: input.organizationId,
      purchaseId: purchase.id,
      receivedAt: input.receivedAt,
      shippingCarrier: normalizeOptional(input.shippingCarrier),
      trackingNumber: normalizeOptional(input.trackingNumber),
      documentReference: normalizeOptional(input.documentReference),
      notes: normalizeOptional(input.notes),
      createdById: input.createdById,
    },
  });

  const createdLines: CreatedOwnedPurchaseLine[] = [];
  for (const plannedLine of plan.lines) {
    const orderLine = orderLines.get(plannedLine.purchaseLineId)!;
    const request = requestedByLine.get(plannedLine.purchaseLineId)!;
    const inventoryNumber = (
      await reserveDocumentNumber(input.organizationId, "OWNED_STOCK", { tx, reference: input.receivedAt })
    ).display;
    const position = await tx.inventoryPosition.create({
      data: {
        organizationId: input.organizationId,
        productId: orderLine.productId,
        inventoryType: "OWNED",
        inventoryNumber,
        itemCondition: request.itemCondition,
        location: normalizeOptional(request.location),
        notes: normalizeOptional(request.notes),
        receivedAt: input.receivedAt,
      },
    });
    await tx.ownedStockLot.create({
      data: {
        organizationId: input.organizationId,
        inventoryPositionId: position.id,
        purchaseLineId: orderLine.id,
        purchaseDate: purchase.purchaseDate,
        vendor: purchase.vendor,
        unitPriceGross: orderLine.unitPriceGross,
        unitPriceNet: orderLine.unitPriceNet,
        vatDeductible: orderLine.vatDeductible,
        paymentMethod: purchase.paymentMethod,
        purchaseEntryStatus: request.purchaseEntryStatus ?? "O",
        returnEntryStatus: request.returnEntryStatus ?? "NN",
        ean: normalizeOptional(request.ean),
        imageUrls: request.imageUrls ?? orderLine.product.imageUrls,
      },
    });
    if (request.platformIds?.length) {
      await tx.inventoryPositionListing.createMany({
        data: request.platformIds.map((platformId) => ({
          organizationId: input.organizationId,
          inventoryPositionId: position.id,
          platformId,
        })),
        skipDuplicates: true,
      });
    }
    const inventoryReceipt = await receiveOwnedStock({
      organizationId: input.organizationId,
      inventoryPositionId: position.id,
      quantity: request.quantity,
      referenceType: "PurchaseReceipt",
      referenceId: receipt.id,
      referenceAction: "purchase_receipt",
      idempotencyKey: `purchase-receipt:${receipt.id}:line:${orderLine.id}`,
      comment: normalizeOptional(request.notes) ?? `Wareneingang ${purchase.purchaseNumber}`,
      createdById: input.createdById,
      bucket: receiptBucket(request.inspectionStatus),
      tx,
    });
    await tx.purchaseReceiptLine.create({
      data: {
        organizationId: input.organizationId,
        purchaseReceiptId: receipt.id,
        purchaseLineId: orderLine.id,
        inventoryPositionId: position.id,
        inboundMovementId: inventoryReceipt.movement.id,
        quantity: request.quantity,
        itemCondition: request.itemCondition,
        legacyCondition: normalizeOptional(request.legacyCondition),
        inspectionStatus: request.inspectionStatus ?? "PASSED",
        returnDeadline: request.returnDeadline ?? plan.returnDeadline,
        notes: normalizeOptional(request.notes),
      },
    });
    createdLines.push({
      product: orderLine.product,
      purchaseLine: orderLine,
      inventoryPosition: inventoryReceipt.position,
      inventoryNumber,
    });
  }

  const complete = purchase.lines.every((line) => {
    const before = effectiveReceivedQuantity({
      receiptQuantities: line.receiptLines.map((item) =>
        item.purchaseReceipt.cancelledAt ? 0 : activeReceiptLineQuantity(item)
      ),
      legacyLotQuantities: line.ownedLots.map((item) => item.inventoryPosition.quantityReceived),
      receiptInventoryPositionIds: line.receiptLines.map((item) => item.inventoryPositionId),
      legacyLots: line.ownedLots.map((item) => ({
        inventoryPositionId: item.inventoryPositionId,
        quantity: item.inventoryPosition.quantityReceived,
      })),
    });
    return before + (requestedByLine.get(line.id)?.quantity ?? 0) === line.quantity;
  });
  const updatedPurchase = await tx.purchase.update({
    where: { id: purchase.id },
    data: {
      purchaseStatus: complete ? "RECEIVED" : "PARTIALLY_RECEIVED",
      shippingStatus: complete ? "DELIVERED" : "PARTIALLY_RECEIVED",
      receivedAt: complete ? input.receivedAt : purchase.receivedAt,
      shippingCarrier: normalizeOptional(input.shippingCarrier) ?? purchase.shippingCarrier,
      trackingNumber: normalizeOptional(input.trackingNumber) ?? purchase.trackingNumber,
      documentReference: normalizeOptional(input.documentReference) ?? purchase.documentReference,
      returnDeadline: plan.returnDeadline ?? purchase.returnDeadline,
    },
  });
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.createdById,
      action: "purchase.receipt.create",
      entityType: "PurchaseReceipt",
      entityId: receipt.id,
      after: {
        purchaseId: purchase.id,
        quantity: plan.totalQuantity,
        complete,
        inventoryNumbers: createdLines.map((line) => line.inventoryNumber),
      },
    },
  });
  return { purchase: updatedPurchase, receipt, lines: createdLines, complete };
}

export async function updatePurchase(input: UpdatePurchaseInput): Promise<Purchase> {
  return withPurchaseTransaction(input.organizationId, input, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:purchase-receipt:${input.organizationId}:${input.purchaseId}`}))`;
    const purchase = await tx.purchase.findFirst({
      where: { id: input.purchaseId, organizationId: input.organizationId },
      include: { lines: { select: { totalGross: true } } },
    });
    if (!purchase) throw new Error("Einkauf wurde nicht gefunden.");
    if (purchase.purchaseStatus === "CANCELLED") {
      throw new Error("Ein stornierter Einkauf kann nicht mehr bearbeitet werden.");
    }

    const supplier = await resolvePurchaseSupplier(tx, input.organizationId, input);
    const liabilityDetailsChanged =
      purchase.purchaseDate.getTime() !== input.purchaseDate.getTime()
      || purchase.vendor !== supplier.displayName
      || purchase.paymentMethod !== input.paymentMethod;
    if (liabilityDetailsChanged) {
      await reconcilePurchaseDebt({
        organizationId: input.organizationId,
        createdById: input.createdById,
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        purchaseDate: input.purchaseDate,
        vendor: supplier.displayName,
        paymentMethod: input.paymentMethod,
        totalGrossCents: purchase.lines.reduce(
          (sum, line) => sum + Math.round(Number(line.totalGross) * 100),
          0
        ),
        tx,
      });
    }
    const updated = await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        purchaseDate: input.purchaseDate,
        vendor: supplier.displayName,
        businessPartnerId: supplier.id,
        paymentMethod: input.paymentMethod,
        supplierOrderNumber: normalizeOptional(input.supplierOrderNumber),
        expectedDeliveryAt: input.expectedDeliveryAt ?? null,
        shippingCarrier: normalizeOptional(input.shippingCarrier),
        trackingNumber: normalizeOptional(input.trackingNumber),
        purchaseStatus: input.purchaseStatus,
        shippingStatus: input.shippingStatus,
        comment: normalizeOptional(input.comment),
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.createdById,
        action: "purchase.update",
        entityType: "Purchase",
        entityId: purchase.id,
        before: purchaseAuditSnapshot(purchase),
        after: purchaseAuditSnapshot(updated),
      },
    });
    return updated;
  });
}

export async function updatePurchaseWorkflowStatus(
  input: UpdatePurchaseWorkflowStatusInput
): Promise<Purchase> {
  if (!input.purchaseStatus && !input.shippingStatus) {
    throw new Error("Mindestens ein Einkaufsstatus muss angegeben werden.");
  }
  return withPurchaseTransaction(input.organizationId, input, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:purchase-receipt:${input.organizationId}:${input.purchaseId}`}))`;
    const purchase = await tx.purchase.findFirst({
      where: { id: input.purchaseId, organizationId: input.organizationId },
    });
    if (!purchase) throw new Error("Einkauf wurde nicht gefunden.");
    if (purchase.purchaseStatus === "CANCELLED") {
      throw new Error("Ein stornierter Einkauf kann nicht mehr bearbeitet werden.");
    }

    const purchaseStatusUnchanged = !input.purchaseStatus
      || input.purchaseStatus === purchase.purchaseStatus;
    const shippingStatusUnchanged = !input.shippingStatus
      || input.shippingStatus === purchase.shippingStatus;
    if (purchaseStatusUnchanged && shippingStatusUnchanged) return purchase;

    const updated = await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        ...(input.purchaseStatus ? { purchaseStatus: input.purchaseStatus } : {}),
        ...(input.shippingStatus ? { shippingStatus: input.shippingStatus } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.createdById,
        action: "purchase.status.update",
        entityType: "Purchase",
        entityId: purchase.id,
        before: {
          purchaseStatus: purchase.purchaseStatus,
          shippingStatus: purchase.shippingStatus,
        },
        after: {
          purchaseStatus: updated.purchaseStatus,
          shippingStatus: updated.shippingStatus,
        },
      },
    });
    return updated;
  });
}

export async function cancelPurchaseReceiptLineQuantity(input: {
  organizationId: string;
  createdById: string;
  inventoryPositionId: string;
  quantity: number;
  idempotencyKey: string;
  comment?: string;
  tx?: PurchaseTransaction;
  prisma?: PurchasePrismaClient;
}): Promise<CancelPurchaseReceiptLineQuantityResult> {
  return withPurchaseTransaction(input.organizationId, input, async (tx) => {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new Error("Die Stornomenge muss eine positive ganze Zahl sein.");
    }
    const target = await tx.purchaseReceiptLine.findFirst({
      where: {
        inventoryPositionId: input.inventoryPositionId,
        organizationId: input.organizationId,
      },
      select: {
        purchaseReceipt: { select: { purchaseId: true } },
      },
    });
    if (!target) throw new Error("Wareneingangsposition wurde nicht gefunden.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:purchase-receipt:${input.organizationId}:${target.purchaseReceipt.purchaseId}`}))`;

    const line = await tx.purchaseReceiptLine.findFirst({
      where: {
        inventoryPositionId: input.inventoryPositionId,
        organizationId: input.organizationId,
      },
      include: {
        inboundMovement: true,
        purchaseReceipt: {
          include: {
            lines: true,
            purchase: {
              include: {
                lines: {
                  include: {
                    receiptLines: {
                      include: {
                        purchaseReceipt: {
                          select: { id: true, cancelledAt: true, receivedAt: true },
                        },
                      },
                    },
                    ownedLots: {
                      select: {
                        inventoryPositionId: true,
                        inventoryPosition: { select: { quantityReceived: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!line) throw new Error("Wareneingangsposition wurde nicht gefunden.");

    const existingCancellation = await tx.inventoryMovement.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (line.purchaseReceipt.purchase.purchaseStatus === "CANCELLED" && !existingCancellation) {
      throw new Error("Die Bestellung ist bereits vollständig storniert.");
    }
    if (line.purchaseReceipt.cancelledAt && !existingCancellation) {
      throw new Error("Der Wareneingang ist bereits vollständig storniert.");
    }

    const remainingBefore = line.quantity - line.cancelledQuantity;
    if (!existingCancellation && input.quantity > remainingBefore) {
      throw new Error(`Es können höchstens noch ${Math.max(0, remainingBefore)} Stück storniert werden.`);
    }
    const reversal = await reverseMovementQuantity({
      organizationId: input.organizationId,
      movementId: line.inboundMovementId,
      quantity: input.quantity,
      idempotencyKey: input.idempotencyKey,
      comment: normalizeOptional(input.comment)
        ?? `Storno ${line.purchaseReceipt.purchase.purchaseNumber}`,
      createdById: input.createdById,
      tx,
    });

    const cancelledQuantity = line.cancelledQuantity
      + (reversal.idempotent ? 0 : input.quantity);
    if (!reversal.idempotent) {
      await tx.purchaseReceiptLine.update({
        where: { id: line.id },
        data: { cancelledQuantity },
      });
    }
    const receiptFullyCancelled = line.purchaseReceipt.lines.every((receiptLine) =>
      receiptLine.id === line.id
        ? cancelledQuantity === receiptLine.quantity
        : receiptLine.cancelledQuantity === receiptLine.quantity
    );
    const cancelledAt = receiptFullyCancelled
      ? line.purchaseReceipt.cancelledAt ?? new Date()
      : null;
    if (receiptFullyCancelled && !line.purchaseReceipt.cancelledAt) {
      await tx.purchaseReceipt.update({
        where: { id: line.purchaseReceipt.id },
        data: { cancelledAt },
      });
    }

    const purchase = line.purchaseReceipt.purchase;
    const progressLines = purchase.lines.map((purchaseLine) => ({
      orderedQuantity: purchaseLine.quantity,
      receivedQuantity: effectiveReceivedQuantity({
        receiptQuantities: purchaseLine.receiptLines.map((receiptLine) => {
          const nextCancelledQuantity = receiptLine.id === line.id
            ? cancelledQuantity
            : receiptLine.cancelledQuantity;
          const targetReceiptCancelled = receiptLine.purchaseReceipt.id === line.purchaseReceipt.id
            && receiptFullyCancelled;
          return receiptLine.purchaseReceipt.cancelledAt || targetReceiptCancelled
            ? 0
            : Math.max(0, receiptLine.quantity - nextCancelledQuantity);
        }),
        legacyLotQuantities: purchaseLine.ownedLots.map((item) =>
          item.inventoryPosition.quantityReceived
        ),
        receiptInventoryPositionIds: purchaseLine.receiptLines.map((item) =>
          item.inventoryPositionId
        ),
        legacyLots: purchaseLine.ownedLots.map((item) => ({
          inventoryPositionId: item.inventoryPositionId,
          quantity: item.inventoryPosition.quantityReceived,
        })),
      }),
    }));
    const progress = derivePurchaseProgress(progressLines);
    const activeReceiptDates = purchase.lines.flatMap((purchaseLine) =>
      purchaseLine.receiptLines
        .filter((receiptLine) => {
          const nextCancelledQuantity = receiptLine.id === line.id
            ? cancelledQuantity
            : receiptLine.cancelledQuantity;
          const targetReceiptCancelled = receiptLine.purchaseReceipt.id === line.purchaseReceipt.id
            && receiptFullyCancelled;
          return !receiptLine.purchaseReceipt.cancelledAt
            && !targetReceiptCancelled
            && receiptLine.quantity - nextCancelledQuantity > 0;
        })
        .map((receiptLine) => receiptLine.purchaseReceipt.receivedAt)
    );
    const updatedPurchase = reversal.idempotent
      ? purchase
      : await tx.purchase.update({
          where: { id: purchase.id },
          data: {
            purchaseStatus: progress.purchaseStatus,
            shippingStatus: progress.purchaseStatus === "ORDERED"
              ? purchase.trackingNumber ? "SHIPPED" : "NOT_SHIPPED"
              : progress.shippingStatus,
            receivedAt: progress.purchaseStatus === "RECEIVED"
              ? activeReceiptDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null
              : null,
          },
        });
    if (!reversal.idempotent) {
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.createdById,
          action: "purchase.receipt_line.cancel",
          entityType: "PurchaseReceiptLine",
          entityId: line.id,
          before: { cancelledQuantity: line.cancelledQuantity },
          after: {
            cancelledQuantity,
            quantity: input.quantity,
            inventoryPositionId: input.inventoryPositionId,
            movementId: reversal.movement.id,
          },
        },
      });
    }
    return {
      purchase: updatedPurchase,
      cancelledQuantity,
      remainingQuantity: Math.max(0, line.quantity - cancelledQuantity),
      idempotent: reversal.idempotent,
    };
  });
}

export async function cancelPurchaseReceipt(input: {
  organizationId: string;
  createdById: string;
  purchaseReceiptId: string;
  comment?: string;
  tx?: PurchaseTransaction;
  prisma?: PurchasePrismaClient;
}): Promise<CancelPurchaseReceiptResult> {
  return withPurchaseTransaction(input.organizationId, input, (tx) =>
    cancelPurchaseReceiptInTransaction(tx, input)
  );
}

async function cancelPurchaseReceiptInTransaction(
  tx: PurchaseTransaction,
  input: {
    organizationId: string;
    createdById: string;
    purchaseReceiptId: string;
    comment?: string;
  }
): Promise<CancelPurchaseReceiptResult> {
  const target = await tx.purchaseReceipt.findFirst({
    where: { id: input.purchaseReceiptId, organizationId: input.organizationId },
    select: { purchaseId: true },
  });
  if (!target) throw new Error("Wareneingang wurde nicht gefunden.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:purchase-receipt:${input.organizationId}:${target.purchaseId}`}))`;

  const receipt = await tx.purchaseReceipt.findFirst({
    where: { id: input.purchaseReceiptId, organizationId: input.organizationId },
    include: {
      lines: { include: { inboundMovement: true } },
      purchase: {
        include: {
          lines: {
            include: {
              receiptLines: {
                include: { purchaseReceipt: { select: { id: true, cancelledAt: true, receivedAt: true } } },
              },
              ownedLots: {
                select: {
                  inventoryPositionId: true,
                  inventoryPosition: { select: { quantityReceived: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!receipt) throw new Error("Wareneingang wurde nicht gefunden.");

  if (receipt.cancelledAt) {
    return { purchase: receipt.purchase, alreadyCancelled: true };
  }
  if (receipt.purchase.purchaseStatus === "CANCELLED") {
    throw new Error("Die Bestellung ist bereits vollständig storniert.");
  }

  await reversePurchaseReceiptLines(tx, {
    organizationId: input.organizationId,
    createdById: input.createdById,
    purchaseNumber: receipt.purchase.purchaseNumber,
    receiptId: receipt.id,
    lines: receipt.lines,
    comment: input.comment,
  });

  const cancelledAt = new Date();
  await tx.purchaseReceipt.update({
    where: { id: receipt.id },
    data: { cancelledAt },
  });

  const progressLines = receipt.purchase.lines.map((line) => ({
    orderedQuantity: line.quantity,
    receivedQuantity: effectiveReceivedQuantity({
      receiptQuantities: line.receiptLines.map((item) =>
        item.purchaseReceipt.id === receipt.id || item.purchaseReceipt.cancelledAt
          ? 0
          : activeReceiptLineQuantity(item)
      ),
      legacyLotQuantities: line.ownedLots.map((item) => item.inventoryPosition.quantityReceived),
      receiptInventoryPositionIds: line.receiptLines.map((item) => item.inventoryPositionId),
      legacyLots: line.ownedLots.map((item) => ({
        inventoryPositionId: item.inventoryPositionId,
        quantity: item.inventoryPosition.quantityReceived,
      })),
    }),
  }));
  const progress = derivePurchaseProgress(progressLines);
  const activeReceiptDates = receipt.purchase.lines.flatMap((line) =>
    line.receiptLines
      .filter((item) => item.purchaseReceipt.id !== receipt.id && !item.purchaseReceipt.cancelledAt)
      .map((item) => item.purchaseReceipt.receivedAt)
  );
  const updatedPurchase = await tx.purchase.update({
    where: { id: receipt.purchase.id },
    data: {
      purchaseStatus: progress.purchaseStatus,
      shippingStatus: progress.purchaseStatus === "ORDERED"
        ? receipt.purchase.trackingNumber ? "SHIPPED" : "NOT_SHIPPED"
        : progress.shippingStatus,
      receivedAt: progress.purchaseStatus === "RECEIVED"
        ? activeReceiptDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null
        : null,
    },
  });
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.createdById,
      action: "purchase.receipt.cancel",
      entityType: "PurchaseReceipt",
      entityId: receipt.id,
      before: { cancelledAt: null, purchaseStatus: receipt.purchase.purchaseStatus },
      after: { cancelledAt, purchaseStatus: updatedPurchase.purchaseStatus },
    },
  });
  return { purchase: updatedPurchase, alreadyCancelled: false };
}

export async function cancelPurchase(input: {
  organizationId: string;
  createdById: string;
  purchaseId: string;
  comment?: string;
  tx?: PurchaseTransaction;
  prisma?: PurchasePrismaClient;
}): Promise<CancelPurchaseResult> {
  return withPurchaseTransaction(input.organizationId, input, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:purchase-receipt:${input.organizationId}:${input.purchaseId}`}))`;
    const purchase = await tx.purchase.findFirst({
      where: { id: input.purchaseId, organizationId: input.organizationId },
      include: {
        receipts: {
          where: { cancelledAt: null },
          include: { lines: { include: { inboundMovement: true } } },
        },
        lines: {
          include: {
            receiptLines: { select: { id: true } },
            ownedLots: {
              select: {
                inventoryPositionId: true,
                inventoryPosition: { select: { quantityReceived: true } },
              },
            },
          },
        },
        debtLinks: { include: { debt: true } },
      },
    });
    if (!purchase) throw new Error("Einkauf wurde nicht gefunden.");
    if (purchase.purchaseStatus === "CANCELLED") {
      return { purchase, alreadyCancelled: true };
    }
    const debtIds = purchase.debtLinks.map((link) => link.debtId).sort();
    for (const debtId of debtIds) {
      await tx.$queryRaw`SELECT "id" FROM "debts" WHERE "id" = ${debtId} AND "organization_id" = ${input.organizationId} FOR UPDATE`;
    }
    const lockedDebts = debtIds.length > 0
      ? await tx.debt.findMany({
          where: { id: { in: debtIds }, organizationId: input.organizationId },
        })
      : [];
    if (lockedDebts.some((debt) => debt.status === "SETTLED" || debt.status === "PARTIALLY_PAID")) {
      throw new Error("Die Bestellung kann nicht storniert werden, solange eine verknüpfte Schuld bereits ganz oder teilweise bezahlt ist.");
    }
    const receiptPositionIds = new Set(
      purchase.receipts.flatMap((receipt) => receipt.lines.map((line) => line.inventoryPositionId))
    );
    const hasLegacyStock = purchase.lines.some((line) =>
      line.ownedLots.some((lot) =>
        !receiptPositionIds.has(lot.inventoryPositionId) && lot.inventoryPosition.quantityReceived > 0
      )
    );
    if (hasLegacyStock) {
      throw new Error("Dieser historische Wareneingang kann nicht automatisch storniert werden.");
    }

    const cancelledAt = new Date();
    for (const receipt of purchase.receipts) {
      await reversePurchaseReceiptLines(tx, {
        organizationId: input.organizationId,
        createdById: input.createdById,
        purchaseNumber: purchase.purchaseNumber,
        receiptId: receipt.id,
        lines: receipt.lines,
        comment: input.comment,
      });
      await tx.purchaseReceipt.update({
        where: { id: receipt.id },
        data: { cancelledAt },
      });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.createdById,
          action: "purchase.receipt.cancel",
          entityType: "PurchaseReceipt",
          entityId: receipt.id,
          before: { cancelledAt: null },
          after: { cancelledAt, purchaseStatus: "CANCELLED" },
        },
      });
    }

    const updated = await tx.purchase.update({
      where: { id: purchase.id },
      data: { purchaseStatus: "CANCELLED", receivedAt: null },
    });
    for (const debt of lockedDebts) {
      if (debt.status === "OPEN") {
        await settleDebt({
          organizationId: input.organizationId,
          debtId: debt.id,
          status: "OTHER",
          userId: input.createdById,
          tx,
        });
      }
    }
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.createdById,
        action: "purchase.cancel",
        entityType: "Purchase",
        entityId: purchase.id,
        before: { status: purchase.purchaseStatus },
        after: { status: "CANCELLED", reversedReceipts: purchase.receipts.length },
      },
    });
    return { purchase: updated, alreadyCancelled: false };
  });
}

async function reversePurchaseReceiptLines(
  tx: PurchaseTransaction,
  input: {
    organizationId: string;
    createdById: string;
    purchaseNumber: string;
    receiptId: string;
    lines: ReadonlyArray<{
      id: string;
      quantity: number;
      cancelledQuantity: number;
      inboundMovement: { id: string };
    }>;
    comment?: string;
  }
): Promise<void> {
  try {
    for (const line of input.lines) {
      const remainingQuantity = line.quantity - line.cancelledQuantity;
      if (remainingQuantity <= 0) continue;
      const reversal = await reverseMovementQuantity({
        organizationId: input.organizationId,
        movementId: line.inboundMovement.id,
        quantity: remainingQuantity,
        idempotencyKey: `purchase-receipt:${input.receiptId}:line:${line.id}:cancel`,
        comment: normalizeOptional(input.comment) ?? `Storno Wareneingang ${input.purchaseNumber}`,
        createdById: input.createdById,
        tx,
      });
      if (!reversal.idempotent) {
        await tx.purchaseReceiptLine.update({
          where: { id: line.id },
          data: { cancelledQuantity: line.quantity },
        });
      }
    }
  } catch (error) {
    if (error instanceof InventoryDomainError && error.code === "INSUFFICIENT_STOCK") {
      throw new Error("Der Wareneingang kann nicht storniert werden, weil die Ware bereits verkauft, reserviert oder in einen anderen Bestand verschoben wurde.");
    }
    throw error;
  }
}

function activeReceiptLineQuantity(line: {
  quantity: number;
  cancelledQuantity: number;
}): number {
  return Math.max(0, line.quantity - line.cancelledQuantity);
}

export async function createOwnedPurchase(
  input: CreateOwnedPurchaseInput
): Promise<CreateOwnedPurchaseResult> {
  const plans = prepareOwnedPurchaseLines(input.lines);
  return withPurchaseTransaction(input.organizationId, input, (tx) =>
    createOwnedPurchaseInTransaction(tx, input, plans)
  );
}

async function createOwnedPurchaseInTransaction(
  tx: PurchaseTransaction,
  input: CreateOwnedPurchaseInput,
  plans: OwnedPurchaseLinePlan[]
): Promise<CreateOwnedPurchaseResult> {
  const supplier = await resolvePurchaseSupplier(tx, input.organizationId, input);
  const debtCreditorName = await validateCommercialReferences(tx, input.organizationId, {
    paymentAccountId: input.paymentAccountId,
  });
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
      vendor: supplier.displayName,
      paymentMethod: input.paymentMethod,
      businessPartnerId: supplier.id,
      paymentAccountId: input.paymentAccountId,
      supplierOrderNumber: normalizeOptional(input.supplierOrderNumber),
      expectedDeliveryAt: input.expectedDeliveryAt,
      receivedAt: input.purchaseDate,
      shippingCarrier: normalizeOptional(input.shippingCarrier),
      trackingNumber: normalizeOptional(input.trackingNumber),
      shippingStatus: "DELIVERED",
      returnDeadline: input.returnDeadline,
      documentReference: normalizeOptional(input.documentReference),
      imageUrl: normalizeOptional(input.imageUrl),
      purchaseStatus: "RECEIVED",
      comment: normalizeOptional(input.comment),
      createdById: input.createdById,
    },
  });

  const purchaseReceipt = await tx.purchaseReceipt.create({
    data: {
      organizationId: input.organizationId,
      purchaseId: purchase.id,
      receivedAt: input.purchaseDate,
      shippingCarrier: normalizeOptional(input.shippingCarrier),
      trackingNumber: normalizeOptional(input.trackingNumber),
      documentReference: normalizeOptional(input.documentReference),
      notes: normalizeOptional(input.comment),
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
        itemCondition: line.itemCondition,
        location: normalizeOptional(line.location),
        notes: normalizeOptional(line.comment),
        receivedAt: input.purchaseDate,
      },
    });

    await tx.ownedStockLot.create({
      data: {
        organizationId: input.organizationId,
        inventoryPositionId: inventoryPosition.id,
        purchaseLineId: purchaseLine.id,
        purchaseDate: input.purchaseDate,
        vendor: supplier.displayName,
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

    const inventoryReceipt = await receiveOwnedStock({
      organizationId: input.organizationId,
      inventoryPositionId: inventoryPosition.id,
      quantity: line.quantity,
      referenceType: "PurchaseLine",
      referenceId: purchaseLine.id,
      referenceAction: "purchase_receipt",
      idempotencyKey: `purchase:${purchase.id}:line:${purchaseLine.id}:receipt`,
      comment: normalizeOptional(line.comment) ?? `Wareneingang ${purchaseNumber}`,
      createdById: input.createdById,
      bucket: receiptBucket(line.inspectionStatus),
      tx,
    });

    await tx.purchaseReceiptLine.create({
      data: {
        organizationId: input.organizationId,
        purchaseReceiptId: purchaseReceipt.id,
        purchaseLineId: purchaseLine.id,
        inventoryPositionId: inventoryPosition.id,
        inboundMovementId: inventoryReceipt.movement.id,
        quantity: line.quantity,
        itemCondition: line.itemCondition,
        legacyCondition: normalizeOptional(line.legacyCondition),
        inspectionStatus: line.inspectionStatus ?? "PASSED",
        returnDeadline: line.returnDeadline ?? input.returnDeadline,
        notes: normalizeOptional(line.comment),
      },
    });

    createdLines.push({
      product,
      purchaseLine,
      inventoryPosition: inventoryReceipt.position,
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
        vendor: supplier.displayName,
        lineCount: plans.length,
        quantity: plans.reduce((sum, line) => sum + line.quantity, 0),
      },
    },
  });

  const debt = await ensurePurchaseDebt({
    organizationId: input.organizationId,
    createdById: input.createdById,
    purchaseId: purchase.id,
    purchaseNumber,
    purchaseDate: input.purchaseDate,
    vendor: supplier.displayName,
    paymentMethod: input.paymentMethod,
    creditorName: debtCreditorName,
    totalGrossCents: plans.reduce((sum, line) => sum + line.totalGrossCents, 0),
    tx,
  });

  return { purchase, purchaseNumber, lines: createdLines, debt, receipt: purchaseReceipt };
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
    return updateProductImages(tx, product, line.imageUrls);
  }

  const existing = await tx.product.findFirst({
    where: {
      organizationId,
      name: line.productName,
      variant: line.variant ?? null,
    },
  });
  if (existing) return updateProductImages(tx, existing, line.imageUrls);

  return tx.product.create({
    data: {
      organizationId,
      name: line.productName,
      variant: line.variant ?? null,
      size: line.size ?? null,
      ean: line.ean ?? null,
      category: line.category ?? null,
      defaultPriceCents: line.unitPriceGrossCents,
      imageUrls: line.imageUrls ?? [],
    },
  });
}

async function updateProductImages(
  tx: PurchaseTransaction,
  product: Product,
  imageUrls: readonly string[] | undefined
): Promise<Product> {
  if (!imageUrls?.length || imageUrls.every((url, index) => product.imageUrls[index] === url)) {
    return product;
  }
  return tx.product.update({
    where: { id: product.id },
    data: { imageUrls: [...imageUrls] },
  });
}

async function withPurchaseTransaction<T>(
  organizationId: string,
  options: { tx?: PurchaseTransaction; prisma?: PurchasePrismaClient },
  operation: (tx: PurchaseTransaction) => Promise<T>
): Promise<T> {
  if (options.tx) return operation(options.tx);
  const client = options.prisma ?? defaultPrisma;
  return client.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    return operation(tx);
  });
}

async function validateCommercialReferences(
  tx: PurchaseTransaction,
  organizationId: string,
  input: { paymentAccountId?: string }
): Promise<string | null> {
  if (input.paymentAccountId) {
    const account = await tx.payoutAccount.findFirst({
      where: { id: input.paymentAccountId, organizationId, active: true },
      select: {
        id: true,
        displayName: true,
        accountType: true,
        businessPartner: { select: { displayName: true } },
      },
    });
    if (!account) throw new Error("Zahlungskonto wurde im Mandanten nicht gefunden.");
    return account.accountType === "SHAREHOLDER_PRIVATE"
      ? account.businessPartner?.displayName ?? account.displayName
      : null;
  }
  return null;
}

async function resolvePurchaseSupplier(
  tx: PurchaseTransaction,
  organizationId: string,
  input: { vendor: string; businessPartnerId?: string; saveSupplier?: boolean }
): Promise<{ id: string | null; displayName: string }> {
  if (input.businessPartnerId) {
    const supplier = await tx.businessPartner.findFirst({
      where: {
        id: input.businessPartnerId,
        organizationId,
        active: true,
        roles: { some: { role: "SUPPLIER" } },
      },
      select: { id: true, displayName: true },
    });
    if (!supplier) throw new Error("Lieferant wurde im Mandanten nicht gefunden.");
    return supplier;
  }

  const displayName = input.vendor.trim();
  if (!displayName) throw new Error("Lieferant ist erforderlich.");
  const existing = await tx.businessPartner.findFirst({
    where: {
      organizationId,
      displayName: { equals: displayName, mode: "insensitive" },
      active: true,
    },
    select: { id: true, displayName: true, roles: { select: { role: true } } },
  });
  if (existing?.roles.some((item) => item.role === "SUPPLIER")) {
    return { id: existing.id, displayName: existing.displayName };
  }
  if (!input.saveSupplier) return { id: null, displayName };

  if (existing) {
    await tx.businessPartnerRole.upsert({
      where: { businessPartnerId_role: { businessPartnerId: existing.id, role: "SUPPLIER" } },
      create: { organizationId, businessPartnerId: existing.id, role: "SUPPLIER" },
      update: {},
    });
    return { id: existing.id, displayName: existing.displayName };
  }

  return tx.businessPartner.create({
    data: {
      organizationId,
      displayName,
      roles: { create: { organizationId, role: "SUPPLIER" } },
    },
    select: { id: true, displayName: true },
  });
}

function purchaseAuditSnapshot(purchase: Purchase): Prisma.InputJsonObject {
  return {
    purchaseDate: purchase.purchaseDate.toISOString(),
    vendor: purchase.vendor,
    paymentMethod: purchase.paymentMethod,
    supplierOrderNumber: purchase.supplierOrderNumber,
    expectedDeliveryAt: purchase.expectedDeliveryAt?.toISOString() ?? null,
    shippingCarrier: purchase.shippingCarrier,
    trackingNumber: purchase.trackingNumber,
    imageUrl: purchase.imageUrl,
    purchaseStatus: purchase.purchaseStatus,
    shippingStatus: purchase.shippingStatus,
    comment: purchase.comment,
  };
}

function receiptBucket(
  inspectionStatus: ReceiptInspectionStatus | undefined
): "AVAILABLE" | "INSPECTION" | "DEFECTIVE" {
  if (inspectionStatus === "PENDING") return "INSPECTION";
  if (inspectionStatus === "DEFECTIVE") return "DEFECTIVE";
  return "AVAILABLE";
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
