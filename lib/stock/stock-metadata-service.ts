import type { ItemCondition, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

type StockMetadataTransaction = Prisma.TransactionClient;
type StockMetadataPrismaClient = Pick<PrismaClient, "$transaction">;
type MetadataValue = string | string[] | null;
type MetadataRecord = Record<string, MetadataValue>;

export interface StockMetadataSnapshot {
  [key: string]: MetadataValue;
  productName: string;
  variant: string | null;
  size: string | null;
  ean: string | null;
  itemCondition: ItemCondition | null;
  imageUrls: string[];
  location: string | null;
  notes: string | null;
}

interface StockMetadataPerformanceTrace {
  measure<T>(name: string, task: () => Promise<T>): Promise<T>;
  measureDb<T>(name: string, task: () => Promise<T>, queryCount?: number): Promise<T>;
}

export class StockMetadataDomainError extends Error {
  constructor(
    public readonly code:
      | "POSITION_NOT_FOUND"
      | "INVENTORY_TYPE_MISMATCH"
      | "PRODUCT_CONFLICT",
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
  productName: string;
  variant: string | null;
  size: string | null;
  ean: string | null;
  itemCondition: ItemCondition | null;
  imageUrls: string[];
  location: string | null;
  notes: string | null;
  tx?: StockMetadataTransaction;
  prisma?: StockMetadataPrismaClient;
  performanceTrace?: StockMetadataPerformanceTrace;
}): Promise<{ changed: boolean; metadata: StockMetadataSnapshot }> {
  return withStockMetadataTransaction(input.organizationId, input, async (tx) => {
    await measureMetadataDb(input.performanceTrace, "metadata.lock_position", () => tx.$queryRaw`
      SELECT ip."id"
      FROM "inventory_positions" ip
      INNER JOIN "products" p
        ON p."id" = ip."product_id"
        AND p."organization_id" = ip."organization_id"
      WHERE ip."id" = ${input.inventoryPositionId}
        AND ip."organization_id" = ${input.organizationId}
      FOR UPDATE OF ip, p
    `);
    const position = await measureMetadataDb(input.performanceTrace, "metadata.load_position", () => tx.inventoryPosition.findFirst({
      where: {
        id: input.inventoryPositionId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        inventoryType: true,
        itemCondition: true,
        location: true,
        notes: true,
        product: {
          select: {
            id: true,
            name: true,
            variant: true,
            size: true,
            ean: true,
            imageUrls: true,
          },
        },
        ownedLot: { select: { imageUrls: true, ean: true } },
      },
    }));
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

    const currentMetadata: StockMetadataSnapshot = {
        productName: position.product.name,
        variant: position.product.variant,
        size: position.product.size,
        ean: position.ownedLot.ean ?? position.product.ean,
        itemCondition: position.itemCondition,
        imageUrls: position.ownedLot.imageUrls.length > 0
          ? position.ownedLot.imageUrls
          : position.product.imageUrls,
        location: position.location,
        notes: position.notes,
      };
    const nextMetadata: StockMetadataSnapshot = {
        productName: input.productName,
        variant: input.variant,
        size: input.size,
        ean: input.ean,
        itemCondition: input.itemCondition,
        imageUrls: input.imageUrls,
        location: input.location,
        notes: input.notes,
      };
    const changes = getStockMetadataChanges(currentMetadata, nextMetadata);
    if (Object.keys(changes.after).length === 0) {
      return { changed: false, metadata: currentMetadata };
    }

    if (
      input.variant !== null
      && ("productName" in changes.after || "variant" in changes.after)
    ) {
      const duplicate = await measureMetadataDb(input.performanceTrace, "metadata.check_product_conflict", () => tx.product.findFirst({
        where: {
          organizationId: input.organizationId,
          id: { not: position.product.id },
          name: input.productName,
          variant: input.variant,
        },
        select: { id: true },
      }));
      if (duplicate) {
        throw new StockMetadataDomainError(
          "PRODUCT_CONFLICT",
          "Ein Produkt mit diesem Namen und dieser Variante ist bereits vorhanden."
        );
      }
    }
    if (
      "productName" in changes.after
      || "variant" in changes.after
      || "size" in changes.after
      || "ean" in changes.after
      || "imageUrls" in changes.after
    ) {
      await measureMetadataDb(input.performanceTrace, "metadata.update_product", () => tx.product.update({
        where: { id: position.product.id },
        data: {
          ...("productName" in changes.after ? { name: input.productName } : {}),
          ...("variant" in changes.after ? { variant: input.variant } : {}),
          ...("size" in changes.after ? { size: input.size } : {}),
          ...("ean" in changes.after ? { ean: input.ean } : {}),
          ...("imageUrls" in changes.after ? { imageUrls: input.imageUrls } : {}),
        },
      }));
    }
    if (
      "itemCondition" in changes.after
      || "location" in changes.after
      || "notes" in changes.after
    ) {
      await measureMetadataDb(input.performanceTrace, "metadata.update_position", () => tx.inventoryPosition.update({
        where: { id: position.id },
        data: {
          ...("itemCondition" in changes.after ? { itemCondition: input.itemCondition } : {}),
          ...("location" in changes.after ? { location: input.location } : {}),
          ...("notes" in changes.after ? { notes: input.notes } : {}),
        },
      }));
    }
    if ("imageUrls" in changes.after || "ean" in changes.after) {
      await measureMetadataDb(input.performanceTrace, "metadata.update_owned_lot", () => tx.ownedStockLot.update({
        where: { inventoryPositionId: position.id },
        data: {
          ...("imageUrls" in changes.after ? { imageUrls: input.imageUrls } : {}),
          ...("ean" in changes.after ? { ean: input.ean } : {}),
        },
      }));
    }
    await measureMetadataDb(input.performanceTrace, "metadata.audit_log", () => tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "inventory_position.updated",
        entityType: "InventoryPosition",
        entityId: position.id,
        before: sanitizeMetadataForAudit(changes.before),
        after: sanitizeMetadataForAudit(changes.after),
      },
    }));
    return { changed: true, metadata: nextMetadata };
  });
}

export async function updateLegacyStockItemMetadata(input: {
  organizationId: string;
  stockItemId: string;
  userId: string;
  productName: string;
  variant: string | null;
  size: string | null;
  ean: string | null;
  itemCondition: ItemCondition | null;
  imageUrls: string[];
  location: string | null;
  notes: string | null;
  tx?: StockMetadataTransaction;
  prisma?: StockMetadataPrismaClient;
  performanceTrace?: StockMetadataPerformanceTrace;
}): Promise<{ changed: boolean; metadata: StockMetadataSnapshot }> {
  return withStockMetadataTransaction(input.organizationId, input, async (tx) => {
    await measureMetadataDb(input.performanceTrace, "metadata.lock_legacy_item", () => tx.$queryRaw`
      SELECT "id"
      FROM "stock_items"
      WHERE "id" = ${input.stockItemId}
        AND "organization_id" = ${input.organizationId}
      FOR UPDATE
    `);
    const item = await measureMetadataDb(input.performanceTrace, "metadata.load_legacy_item", () => tx.stockItem.findFirst({
      where: { id: input.stockItemId, organizationId: input.organizationId },
      select: {
        id: true,
        title: true,
        variant: true,
        size: true,
        ean: true,
        itemCondition: true,
        imageUrls: true,
        location: true,
        notes: true,
      },
    }));
    if (!item) {
      throw new StockMetadataDomainError(
        "POSITION_NOT_FOUND",
        "Lagerposition wurde nicht gefunden."
      );
    }

    const next: StockMetadataSnapshot = {
      productName: input.productName,
      variant: input.variant,
      size: input.size,
      ean: input.ean,
      itemCondition: input.itemCondition,
      imageUrls: input.imageUrls,
      location: input.location,
      notes: input.notes,
    };
    const currentMetadata: StockMetadataSnapshot = {
        productName: item.title,
        variant: item.variant,
        size: item.size,
        ean: item.ean,
        itemCondition: item.itemCondition,
        imageUrls: item.imageUrls,
        location: item.location,
        notes: item.notes,
      };
    const changes = getStockMetadataChanges(currentMetadata, next);
    if (Object.keys(changes.after).length === 0) {
      return { changed: false, metadata: currentMetadata };
    }

    await measureMetadataDb(input.performanceTrace, "metadata.update_legacy_item", () => tx.stockItem.update({
      where: { id: item.id },
      data: {
        ...("productName" in changes.after ? { title: input.productName } : {}),
        ...("variant" in changes.after ? { variant: input.variant } : {}),
        ...("size" in changes.after ? { size: input.size } : {}),
        ...("ean" in changes.after ? { ean: input.ean } : {}),
        ...("itemCondition" in changes.after ? { itemCondition: input.itemCondition } : {}),
        ...("imageUrls" in changes.after ? { imageUrls: input.imageUrls } : {}),
        ...("location" in changes.after ? { location: input.location } : {}),
        ...("notes" in changes.after ? { notes: input.notes } : {}),
      },
    }));
    await measureMetadataDb(input.performanceTrace, "metadata.audit_log", () => tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "inventory_position.updated",
        entityType: "StockItem",
        entityId: item.id,
        before: sanitizeMetadataForAudit(changes.before),
        after: sanitizeMetadataForAudit(changes.after),
      },
    }));
    return { changed: true, metadata: next };
  });
}

async function withStockMetadataTransaction<T>(
  organizationId: string,
  options: {
    tx?: StockMetadataTransaction;
    prisma?: StockMetadataPrismaClient;
    performanceTrace?: StockMetadataPerformanceTrace;
  },
  operation: (tx: StockMetadataTransaction) => Promise<T>
): Promise<T> {
  if (options.tx) return operation(options.tx);
  const client = options.prisma ?? defaultPrisma;
  const transaction = () => client.$transaction(async (tx) => {
    await measureMetadataDb(options.performanceTrace, "metadata.set_tenant_context", () =>
      tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`
    );
    return operation(tx);
  });
  return options.performanceTrace
    ? options.performanceTrace.measure("metadata.transaction", transaction)
    : transaction();
}

function measureMetadataDb<T>(
  trace: StockMetadataPerformanceTrace | undefined,
  name: string,
  task: () => Promise<T>
): Promise<T> {
  return trace ? trace.measureDb(name, task) : task();
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
