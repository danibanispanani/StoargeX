import {
  InventoryBucket,
  InventoryMovementType,
  InventoryType,
  Prisma,
  type InventoryMovement,
  type InventoryPosition,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

type InventoryTransaction = Pick<
  Prisma.TransactionClient,
  "$executeRaw" | "inventoryPosition" | "inventoryMovement" | "auditLog"
>;

type InventoryPrismaClient = Pick<PrismaClient, "$transaction">;

type BucketField =
  | "quantityAvailable"
  | "quantityReserved"
  | "quantityInspection"
  | "quantityDefective";

type CounterField = "quantityReceived" | "quantitySold";
type QuantityField = BucketField | CounterField;

const BUCKET_FIELD: Record<InventoryBucket, BucketField> = {
  AVAILABLE: "quantityAvailable",
  RESERVED: "quantityReserved",
  INSPECTION: "quantityInspection",
  DEFECTIVE: "quantityDefective",
};

const QUANTITY_FIELDS: QuantityField[] = [
  "quantityReceived",
  "quantityAvailable",
  "quantityReserved",
  "quantityInspection",
  "quantityDefective",
  "quantitySold",
];

export type InventoryDomainErrorCode =
  | "INVALID_QUANTITY"
  | "INVALID_MOVEMENT"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "POSITION_NOT_FOUND"
  | "INVENTORY_TYPE_MISMATCH"
  | "INSUFFICIENT_STOCK"
  | "MOVEMENT_NOT_FOUND"
  | "MOVEMENT_NOT_REVERSIBLE";

export class InventoryDomainError extends Error {
  constructor(
    public readonly code: InventoryDomainErrorCode,
    message: string
  ) {
    super(message);
    this.name = "InventoryDomainError";
  }
}

export interface InventoryMutationResult {
  position: InventoryPosition;
  movement: InventoryMovement;
  idempotent: boolean;
}

export interface InventoryMovementInput {
  organizationId: string;
  inventoryPositionId: string;
  movementType: InventoryMovementType;
  quantity: number;
  fromBucket: InventoryBucket | null;
  toBucket: InventoryBucket | null;
  referenceType?: string;
  referenceId?: string;
  referenceAction?: string;
  idempotencyKey?: string;
  comment?: string;
  createdById?: string;
  tx?: InventoryTransaction;
  prisma?: InventoryPrismaClient;
  audit?: boolean;
  requiredInventoryType?: InventoryType;
  counterDeltas?: Partial<Record<CounterField, number>>;
}

type ServiceInput = Omit<
  InventoryMovementInput,
  "movementType" | "fromBucket" | "toBucket" | "counterDeltas"
>;

export type AdjustmentDirection = "IN" | "OUT";

export async function receiveOwnedStock(
  input: ServiceInput & { bucket?: Extract<InventoryBucket, "AVAILABLE" | "INSPECTION" | "DEFECTIVE"> }
): Promise<InventoryMutationResult> {
  return applyInventoryMovement({
    ...input,
    movementType: "PURCHASE_RECEIPT",
    fromBucket: null,
    toBucket: input.bucket ?? "AVAILABLE",
    requiredInventoryType: "OWNED",
  });
}

export async function receiveConsignmentStock(
  input: ServiceInput
): Promise<InventoryMutationResult> {
  return applyInventoryMovement({
    ...input,
    movementType: "CONSIGNMENT_RECEIPT",
    fromBucket: null,
    toBucket: "AVAILABLE",
    requiredInventoryType: "CONSIGNMENT",
  });
}

export async function reserve(
  input: ServiceInput
): Promise<InventoryMutationResult> {
  return applyInventoryMovement({
    ...input,
    movementType: "RESERVE",
    fromBucket: "AVAILABLE",
    toBucket: "RESERVED",
  });
}

export async function releaseReservation(
  input: ServiceInput
): Promise<InventoryMutationResult> {
  return applyInventoryMovement({
    ...input,
    movementType: "RELEASE_RESERVATION",
    fromBucket: "RESERVED",
    toBucket: "AVAILABLE",
  });
}

export async function sell(
  input: ServiceInput
): Promise<InventoryMutationResult> {
  return applyInventoryMovement({
    ...input,
    movementType: "SALE_OUT",
    fromBucket: "AVAILABLE",
    toBucket: null,
  });
}

export async function receiveReturn(
  input: ServiceInput
): Promise<InventoryMutationResult> {
  return applyInventoryMovement({
    ...input,
    movementType: "RETURN_RECEIPT",
    fromBucket: null,
    toBucket: "INSPECTION",
  });
}

export async function restockReturn(
  input: ServiceInput
): Promise<InventoryMutationResult> {
  return applyInventoryMovement({
    ...input,
    movementType: "RETURN_RESTOCK",
    fromBucket: "INSPECTION",
    toBucket: "AVAILABLE",
  });
}

export async function markReturnDefective(
  input: ServiceInput
): Promise<InventoryMutationResult> {
  return applyInventoryMovement({
    ...input,
    movementType: "RETURN_DEFECTIVE",
    fromBucket: "INSPECTION",
    toBucket: "DEFECTIVE",
  });
}

export async function adjust(
  input: ServiceInput & {
    direction: AdjustmentDirection;
    bucket?: InventoryBucket;
  }
): Promise<InventoryMutationResult> {
  const bucket = input.bucket ?? "AVAILABLE";
  const base = {
    organizationId: input.organizationId,
    inventoryPositionId: input.inventoryPositionId,
    quantity: input.quantity,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceAction: input.referenceAction,
    idempotencyKey: input.idempotencyKey,
    comment: input.comment,
    createdById: input.createdById,
    tx: input.tx,
    prisma: input.prisma,
    audit: input.audit,
    requiredInventoryType: input.requiredInventoryType,
  };

  if (input.direction === "IN") {
    return applyInventoryMovement({
      ...base,
      movementType: "ADJUSTMENT_IN",
      fromBucket: null,
      toBucket: bucket,
    });
  }

  return applyInventoryMovement({
    ...base,
    movementType: "ADJUSTMENT_OUT",
    fromBucket: bucket,
    toBucket: null,
  });
}

export async function reverseMovement(input: {
  organizationId: string;
  movementId: string;
  idempotencyKey?: string;
  comment?: string;
  createdById?: string;
  tx?: InventoryTransaction;
  prisma?: InventoryPrismaClient;
  audit?: boolean;
}): Promise<InventoryMutationResult> {
  return withInventoryTransaction(input.organizationId, input, async (tx) => {
    const original = await tx.inventoryMovement.findFirst({
      where: { id: input.movementId, organizationId: input.organizationId },
    });

    if (!original) {
      throw new InventoryDomainError(
        "MOVEMENT_NOT_FOUND",
        "Bestandsbewegung wurde in dieser Organisation nicht gefunden."
      );
    }

    if (original.movementType === "REVERSAL") {
      throw new InventoryDomainError(
        "MOVEMENT_NOT_REVERSIBLE",
        "Eine Storno-Bewegung kann nicht erneut storniert werden."
      );
    }

    const originalCounterDeltas = getCounterDeltas(
      original.movementType,
      original.quantity
    );
    const counterDeltas = invertCounterDeltas(originalCounterDeltas);

    return applyInventoryMovement({
      organizationId: input.organizationId,
      inventoryPositionId: original.inventoryPositionId,
      movementType: "REVERSAL",
      quantity: original.quantity,
      fromBucket: original.toBucket,
      toBucket: original.fromBucket,
      referenceType: "InventoryMovement",
      referenceId: original.id,
      referenceAction: "reverse",
      idempotencyKey: input.idempotencyKey,
      comment: input.comment,
      createdById: input.createdById,
      tx,
      audit: input.audit,
      counterDeltas,
    });
  });
}

export async function getInventoryTimeline(input: {
  organizationId: string;
  inventoryPositionId: string;
  tx?: InventoryTransaction;
  prisma?: InventoryPrismaClient;
}): Promise<InventoryMovement[]> {
  return withInventoryTransaction(input.organizationId, input, async (tx) => {
    const position = await tx.inventoryPosition.findFirst({
      where: {
        id: input.inventoryPositionId,
        organizationId: input.organizationId,
      },
      select: { id: true },
    });

    if (!position) {
      throw new InventoryDomainError(
        "POSITION_NOT_FOUND",
        "Bestandsposition wurde in dieser Organisation nicht gefunden."
      );
    }

    return tx.inventoryMovement.findMany({
      where: {
        organizationId: input.organizationId,
        inventoryPositionId: input.inventoryPositionId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });
}

export async function applyInventoryMovement(
  input: InventoryMovementInput
): Promise<InventoryMutationResult> {
  return withInventoryTransaction(input.organizationId, input, (tx) =>
    applyInventoryMovementInTransaction(tx, input)
  );
}

async function withInventoryTransaction<T>(
  organizationId: string,
  options: { tx?: InventoryTransaction; prisma?: InventoryPrismaClient },
  operation: (tx: InventoryTransaction) => Promise<T>
): Promise<T> {
  if (options.tx) return operation(options.tx);

  const client = options.prisma ?? defaultPrisma;
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    return operation(tx);
  });
}

async function applyInventoryMovementInTransaction(
  tx: InventoryTransaction,
  input: InventoryMovementInput
): Promise<InventoryMutationResult> {
  assertBaseInput(input);

  const existing = await findExistingIdempotentMovement(tx, input);
  if (existing) {
    assertIdempotencyMatch(existing, input);
    const position = await requirePosition(tx, input);
    return { position, movement: existing, idempotent: true };
  }

  const positionBefore = await requirePosition(tx, input);
  if (
    input.requiredInventoryType &&
    positionBefore.inventoryType !== input.requiredInventoryType
  ) {
    throw new InventoryDomainError(
      "INVENTORY_TYPE_MISMATCH",
      `Bestandsposition ist ${positionBefore.inventoryType}, erwartet wurde ${input.requiredInventoryType}.`
    );
  }

  const deltas = buildQuantityDeltas(input);
  const nextQuantities = calculateNextQuantities(positionBefore, deltas);
  assertNonNegativeQuantities(nextQuantities);

  const updateResult = await tx.inventoryPosition.updateMany({
    where: buildAtomicUpdateWhere(input, deltas),
    data: buildUpdateData(deltas),
  });

  if (updateResult.count !== 1) {
    throw new InventoryDomainError(
      "INSUFFICIENT_STOCK",
      "Bestandsbewegung konnte nicht atomar angewendet werden; Bestand ist vermutlich unzureichend oder wurde parallel verändert."
    );
  }

  const movement = await tx.inventoryMovement.create({
    data: {
      organizationId: input.organizationId,
      inventoryPositionId: input.inventoryPositionId,
      movementType: input.movementType,
      quantity: input.quantity,
      fromBucket: input.fromBucket,
      toBucket: input.toBucket,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      referenceAction: input.referenceAction,
      idempotencyKey: input.idempotencyKey,
      comment: input.comment,
      createdById: input.createdById,
    },
  });

  const positionAfter = await requirePosition(tx, input);

  if (input.audit !== false) {
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.createdById,
        action: "inventory.movement",
        entityType: "InventoryPosition",
        entityId: input.inventoryPositionId,
        before: positionSnapshot(positionBefore),
        after: {
          movement: movementSnapshot(movement),
          position: positionSnapshot(positionAfter),
        },
      },
    });
  }

  return { position: positionAfter, movement, idempotent: false };
}

async function requirePosition(
  tx: InventoryTransaction,
  input: Pick<InventoryMovementInput, "organizationId" | "inventoryPositionId">
): Promise<InventoryPosition> {
  const position = await tx.inventoryPosition.findFirst({
    where: {
      id: input.inventoryPositionId,
      organizationId: input.organizationId,
    },
  });

  if (!position) {
    throw new InventoryDomainError(
      "POSITION_NOT_FOUND",
      "Bestandsposition wurde in dieser Organisation nicht gefunden."
    );
  }

  return position;
}

async function findExistingIdempotentMovement(
  tx: InventoryTransaction,
  input: InventoryMovementInput
): Promise<InventoryMovement | null> {
  if (!input.idempotencyKey) return null;

  return tx.inventoryMovement.findUnique({
    where: {
      organizationId_idempotencyKey: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
}

function assertBaseInput(input: InventoryMovementInput): void {
  if (!input.organizationId) {
    throw new InventoryDomainError(
      "INVALID_MOVEMENT",
      "organizationId ist erforderlich."
    );
  }
  if (!input.inventoryPositionId) {
    throw new InventoryDomainError(
      "INVALID_MOVEMENT",
      "inventoryPositionId ist erforderlich."
    );
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new InventoryDomainError(
      "INVALID_QUANTITY",
      "quantity muss eine positive ganze Zahl sein."
    );
  }
  if (input.fromBucket === null && input.toBucket === null) {
    throw new InventoryDomainError(
      "INVALID_MOVEMENT",
      "fromBucket und toBucket dürfen nicht beide null sein."
    );
  }
  if (input.fromBucket !== null && input.fromBucket === input.toBucket) {
    throw new InventoryDomainError(
      "INVALID_MOVEMENT",
      "fromBucket und toBucket dürfen nicht identisch sein."
    );
  }
}

function assertIdempotencyMatch(
  existing: InventoryMovement,
  input: InventoryMovementInput
): void {
  const sameMovement =
    existing.organizationId === input.organizationId &&
    existing.inventoryPositionId === input.inventoryPositionId &&
    existing.movementType === input.movementType &&
    existing.quantity === input.quantity &&
    existing.fromBucket === input.fromBucket &&
    existing.toBucket === input.toBucket;

  if (!sameMovement) {
    throw new InventoryDomainError(
      "IDEMPOTENCY_KEY_CONFLICT",
      "idempotencyKey wurde bereits für eine andere Bestandsbewegung verwendet."
    );
  }
}

function buildQuantityDeltas(
  input: InventoryMovementInput
): Record<QuantityField, number> {
  const deltas = emptyDeltas();

  if (input.fromBucket) {
    deltas[BUCKET_FIELD[input.fromBucket]] -= input.quantity;
  }
  if (input.toBucket) {
    deltas[BUCKET_FIELD[input.toBucket]] += input.quantity;
  }

  const counterDeltas =
    input.counterDeltas ?? getCounterDeltas(input.movementType, input.quantity);
  for (const field of Object.keys(counterDeltas) as CounterField[]) {
    deltas[field] += counterDeltas[field] ?? 0;
  }

  return deltas;
}

function getCounterDeltas(
  movementType: InventoryMovementType,
  quantity: number
): Partial<Record<CounterField, number>> {
  switch (movementType) {
    case "PURCHASE_RECEIPT":
    case "CONSIGNMENT_RECEIPT":
    case "ADJUSTMENT_IN":
      return { quantityReceived: quantity };
    case "SALE_OUT":
      return { quantitySold: quantity };
    case "RETURN_RECEIPT":
      return { quantityReceived: quantity, quantitySold: -quantity };
    default:
      return {};
  }
}

function invertCounterDeltas(
  deltas: Partial<Record<CounterField, number>>
): Partial<Record<CounterField, number>> {
  const inverted: Partial<Record<CounterField, number>> = {};
  for (const field of Object.keys(deltas) as CounterField[]) {
    inverted[field] = -(deltas[field] ?? 0);
  }
  return inverted;
}

function emptyDeltas(): Record<QuantityField, number> {
  return {
    quantityReceived: 0,
    quantityAvailable: 0,
    quantityReserved: 0,
    quantityInspection: 0,
    quantityDefective: 0,
    quantitySold: 0,
  };
}

function calculateNextQuantities(
  position: InventoryPosition,
  deltas: Record<QuantityField, number>
): Record<QuantityField, number> {
  return {
    quantityReceived: position.quantityReceived + deltas.quantityReceived,
    quantityAvailable: position.quantityAvailable + deltas.quantityAvailable,
    quantityReserved: position.quantityReserved + deltas.quantityReserved,
    quantityInspection: position.quantityInspection + deltas.quantityInspection,
    quantityDefective: position.quantityDefective + deltas.quantityDefective,
    quantitySold: position.quantitySold + deltas.quantitySold,
  };
}

function assertNonNegativeQuantities(
  quantities: Record<QuantityField, number>
): void {
  for (const field of QUANTITY_FIELDS) {
    if (quantities[field] < 0) {
      throw new InventoryDomainError(
        "INSUFFICIENT_STOCK",
        `${field} würde negativ werden.`
      );
    }
  }
}

function buildAtomicUpdateWhere(
  input: InventoryMovementInput,
  deltas: Record<QuantityField, number>
): Prisma.InventoryPositionWhereInput {
  const where: Prisma.InventoryPositionWhereInput = {
    id: input.inventoryPositionId,
    organizationId: input.organizationId,
  };

  for (const field of QUANTITY_FIELDS) {
    if (deltas[field] < 0) addGteGuard(where, field, -deltas[field]);
  }

  return where;
}

function addGteGuard(
  where: Prisma.InventoryPositionWhereInput,
  field: QuantityField,
  value: number
): void {
  (where as Record<string, unknown>)[field] = { gte: value };
}

function buildUpdateData(
  deltas: Record<QuantityField, number>
): Prisma.InventoryPositionUpdateManyMutationInput {
  const data: Prisma.InventoryPositionUpdateManyMutationInput = {};

  for (const field of QUANTITY_FIELDS) {
    const delta = deltas[field];
    if (delta === 0) continue;
    (data as Record<string, unknown>)[field] =
      delta > 0 ? { increment: delta } : { decrement: -delta };
  }

  return data;
}

function positionSnapshot(position: InventoryPosition): Prisma.InputJsonObject {
  return {
    id: position.id,
    organizationId: position.organizationId,
    inventoryType: position.inventoryType,
    inventoryNumber: position.inventoryNumber,
    quantityReceived: position.quantityReceived,
    quantityAvailable: position.quantityAvailable,
    quantityReserved: position.quantityReserved,
    quantityInspection: position.quantityInspection,
    quantityDefective: position.quantityDefective,
    quantitySold: position.quantitySold,
  };
}

function movementSnapshot(movement: InventoryMovement): Prisma.InputJsonObject {
  return {
    id: movement.id,
    movementType: movement.movementType,
    quantity: movement.quantity,
    fromBucket: movement.fromBucket,
    toBucket: movement.toBucket,
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    referenceAction: movement.referenceAction,
    idempotencyKey: movement.idempotencyKey,
  };
}
