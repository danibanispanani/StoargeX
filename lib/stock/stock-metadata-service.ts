import type { ItemCondition, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

type StockMetadataTransaction = Prisma.TransactionClient;
type StockMetadataPrismaClient = Pick<PrismaClient, "$transaction">;
type MetadataValue = string | string[] | null;
type MetadataRecord = Record<string, MetadataValue>;

export class StockMetadataDomainError extends Error {
  constructor(
    public readonly code: "POSITION_NOT_FOUND" | "INVENTORY_TYPE_MISMATCH",
    message: string
  ) {
    super(message);
    this.name = "StockMetadataDomainError";
  }
}

export function getStockMetadataChanges(
  before: MetadataRecord,
  after: MetadataRecord
): { before: MetadataRecord; after: MetadataRecord } {
  const changedBefore: MetadataRecord = {};
  const changedAfter: MetadataRecord = {};

  for (const [field, nextValue] of Object.entries(after)) {
    const previousValue = before[field] ?? null;
    if (metadataValuesEqual(previousValue, nextValue)) continue;
    changedBefore[field] = previousValue;
    changedAfter[field] = nextValue;
  }

  return { before: changedBefore, after: changedAfter };
}

export async function updateInventoryPositionMetadata(input: {
  organizationId: string;
  inventoryPositionId: string;
  userId: string;
  itemCondition: ItemCondition | null;
  imageUrls: string[];
  tx?: StockMetadataTransaction;
  prisma?: StockMetadataPrismaClient;
}): Promise<{ changed: boolean }> {
  return withStockMetadataTransaction(input.organizationId, input, async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "inventory_positions"
      WHERE "id" = ${input.inventoryPositionId}
        AND "organization_id" = ${input.organizationId}
      FOR UPDATE
    `;
    const position = await tx.inventoryPosition.findFirst({
      where: {
        id: input.inventoryPositionId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        inventoryType: true,
        itemCondition: true,
        ownedLot: { select: { imageUrls: true } },
      },
    });
    if (!position) {
      throw new StockMetadataDomainError(
        "POSITION_NOT_FOUND",
        "Lagerposition wurde nicht gefunden."
      );
    }
    if (position.inventoryType !== "OWNED" || !position.ownedLot) {
      throw new StockMetadataDomainError(
        "INVENTORY_TYPE_MISMATCH",
        "Diese Metadaten können nur für eine eigene Lagerposition bearbeitet werden."
      );
    }

    const changes = getStockMetadataChanges(
      {
        itemCondition: position.itemCondition,
        imageUrls: position.ownedLot.imageUrls,
      },
      {
        itemCondition: input.itemCondition,
        imageUrls: input.imageUrls,
      }
    );
    if (Object.keys(changes.after).length === 0) return { changed: false };

    if ("itemCondition" in changes.after) {
      await tx.inventoryPosition.update({
        where: { id: position.id },
        data: { itemCondition: input.itemCondition },
      });
    }
    if ("imageUrls" in changes.after) {
      await tx.ownedStockLot.update({
        where: { inventoryPositionId: position.id },
        data: { imageUrls: input.imageUrls },
      });
    }
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "inventory_position.updated",
        entityType: "InventoryPosition",
        entityId: position.id,
        before: sanitizeMetadataForAudit(changes.before),
        after: sanitizeMetadataForAudit(changes.after),
      },
    });
    return { changed: true };
  });
}

export async function updateLegacyStockItemMetadata(input: {
  organizationId: string;
  stockItemId: string;
  userId: string;
  itemCondition: ItemCondition | null;
  imageUrls: string[];
  location: string | null;
  notes: string | null;
  tx?: StockMetadataTransaction;
  prisma?: StockMetadataPrismaClient;
}): Promise<{ changed: boolean }> {
  return withStockMetadataTransaction(input.organizationId, input, async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "stock_items"
      WHERE "id" = ${input.stockItemId}
        AND "organization_id" = ${input.organizationId}
      FOR UPDATE
    `;
    const item = await tx.stockItem.findFirst({
      where: { id: input.stockItemId, organizationId: input.organizationId },
      select: {
        id: true,
        itemCondition: true,
        imageUrls: true,
        location: true,
        notes: true,
      },
    });
    if (!item) {
      throw new StockMetadataDomainError(
        "POSITION_NOT_FOUND",
        "Lagerposition wurde nicht gefunden."
      );
    }

    const next = {
      itemCondition: input.itemCondition,
      imageUrls: input.imageUrls,
      location: input.location,
      notes: input.notes,
    };
    const changes = getStockMetadataChanges(item, next);
    if (Object.keys(changes.after).length === 0) return { changed: false };

    await tx.stockItem.update({
      where: { id: item.id },
      data: Object.fromEntries(
        Object.keys(changes.after).map((field) => [field, next[field as keyof typeof next]])
      ),
    });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "inventory_position.updated",
        entityType: "StockItem",
        entityId: item.id,
        before: sanitizeMetadataForAudit(changes.before),
        after: sanitizeMetadataForAudit(changes.after),
      },
    });
    return { changed: true };
  });
}

async function withStockMetadataTransaction<T>(
  organizationId: string,
  options: { tx?: StockMetadataTransaction; prisma?: StockMetadataPrismaClient },
  operation: (tx: StockMetadataTransaction) => Promise<T>
): Promise<T> {
  if (options.tx) return operation(options.tx);
  const client = options.prisma ?? defaultPrisma;
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    return operation(tx);
  });
}

function metadataValuesEqual(left: MetadataValue, right: MetadataValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

function sanitizeMetadataForAudit(values: MetadataRecord): MetadataRecord {
  if (!Array.isArray(values.imageUrls)) return values;
  return {
    ...values,
    imageUrls: values.imageUrls.map((value) => {
      const url = new URL(value);
      const suffix = `${url.search ? "?[Parameter ausgeblendet]" : ""}${
        url.hash ? "#[Fragment ausgeblendet]" : ""
      }`;
      return `${url.protocol}//${url.host}${url.pathname}${suffix}`;
    }),
  };
}
