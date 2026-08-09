"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  EntryStatus,
  ItemCondition,
  StockItemStatus,
  type InventoryBucket,
  type InventoryMovementType,
} from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { assertFeatureAccess } from "@/lib/feature-access";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";
import { writeAuditLog } from "@/lib/audit";
import { calcPurchaseNetCents, euroToCents } from "@/lib/calculations";
import { createOwnedPurchase } from "@/lib/services/owned-purchase-service";
import { httpImageUrlSchema } from "@/lib/validation/http-image-url";
import { parseHttpUrlList } from "@/lib/url-list";
import {
  updateInventoryPositionMetadata,
  updateLegacyStockItemMetadata,
} from "@/lib/stock/stock-metadata-service";
import type { ActionState } from "@/lib/actions/team";
import { createLagerPerformanceTrace } from "@/lib/stock/lager-performance";
import {
  ACTIVE_SUPPLIER_RETURN_PLAN_STATUSES,
  calculateSupplierReturnableQuantity,
} from "@/lib/services/supplier-return-service";

export interface StockMetadataPatch {
  id: string;
  source: "owned" | "legacy";
  title: string;
  variant: string;
  size: string;
  ean: string;
  itemCondition: ItemCondition | null;
  imageUrls: string[];
  imageUrl: string | null;
  location: string | null;
  notes: string;
}

export type StockMetadataActionState =
  | { error?: string; success?: string; rowPatch?: StockMetadataPatch }
  | null;

const stockItemSchema = z.object({
  productId: z.string().optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  supplier: z.string().max(200).optional().or(z.literal("")), // HÃ¤ndler
  title: z.string().min(1, "Model fehlt.").max(300), // Model
  variant: z.string().max(200).optional().or(z.literal("")), // Colorway/Version
  size: z.string().max(50).optional().or(z.literal("")),
  priceGross: z.string().min(1, "Brutto-Preis fehlt."),
  inputTaxDeductible: z.coerce.boolean(), // VST
  inputTaxRatePercent: z.coerce.number().min(0).max(100).default(19),
  paymentMethod: z.string().min(1, "Zahlungsmethode (ZM) fehlt.").max(100),
  ean: z.string().max(20).regex(/^\d*$/, "EAN darf nur Ziffern enthalten.").optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(500).default(1),
  itemCondition: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.nativeEnum(ItemCondition).optional()
  ),
  location: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  imageUrl: httpImageUrlSchema.optional().or(z.literal("")),
  platformIds: z.array(z.string().min(1)).default([]),
});

function parseStockForm(formData: FormData) {
  const parsed = stockItemSchema.safeParse({
    productId: formData.get("productId"),
    purchaseDate: formData.get("purchaseDate"),
    supplier: formData.get("supplier"),
    title: formData.get("title"),
    variant: formData.get("variant"),
    size: formData.get("size"),
    priceGross: formData.get("priceGross"),
    inputTaxDeductible: formData.get("inputTaxDeductible") === "on",
    inputTaxRatePercent: formData.get("inputTaxRatePercent") || 19,
    paymentMethod: formData.get("paymentMethod"),
    ean: formData.get("ean"),
    quantity: formData.get("quantity") || 1,
    itemCondition: formData.get("itemCondition") ?? "",
    location: formData.get("location") ?? "",
    notes: formData.get("notes"),
    imageUrl: formData.get("imageUrl") || "",
    platformIds: formData.getAll("platformIds").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "UngÃ¼ltige Eingaben." } as const;
  }
  let grossCents: number;
  try {
    grossCents = euroToCents(parsed.data.priceGross);
  } catch {
    return { error: "UngÃ¼ltiger Brutto-Preis." } as const;
  }
  return { data: parsed.data, grossCents } as const;
}

/**
 * Wareneingang erfassen.
 * Neue EintrÃ¤ge laufen Ã¼ber Purchase/PurchaseLine/InventoryPosition/OwnedStockLot.
 * Legacy-StockItems bleiben fÃ¼r bestehende Daten und Bearbeitung erhalten.
 */
export async function createStockItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const result = parseStockForm(formData);
  if ("error" in result) return { error: result.error };
  const { data, grossCents } = result;

  const imageUrls = data.imageUrl ? [data.imageUrl] : [];

  const platforms = data.platformIds.length
    ? await db.platform.findMany({ where: { id: { in: data.platformIds } } })
    : [];
  if (platforms.length !== data.platformIds.length) {
    return { error: "Mindestens eine gewÃ¤hlte Plattform ist ungÃ¼ltig." };
  }
  if (data.location) {
    const location = await db.selectOption.findFirst({
      where: { kind: "STORAGE_LOCATION", label: data.location, active: true },
      select: { id: true },
    });
    if (!location) return { error: "Der gewählte Lagerstandort ist nicht mehr verfügbar." };
  }

  const netCents = calcPurchaseNetCents(
    grossCents,
    data.inputTaxDeductible,
    data.inputTaxRatePercent
  );
  const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : new Date();

  try {
    const created = await createOwnedPurchase({
      organizationId: organization.id,
      createdById: userId,
      purchaseDate,
      vendor: data.supplier || "Unbekannt",
      paymentMethod: data.paymentMethod,
      comment: data.notes || undefined,
      lines: [
        {
          productId: data.productId || undefined,
          productName: data.title,
          variant: data.variant || undefined,
          size: data.size || undefined,
          ean: data.ean || undefined,
          quantity: data.quantity,
          unitPriceGrossCents: grossCents,
          inputTaxDeductible: data.inputTaxDeductible,
          inputTaxRatePercent: data.inputTaxRatePercent,
          purchaseEntryStatus: "O",
          returnEntryStatus: "NN",
          platformIds: platforms.map((p) => p.id),
          imageUrls,
          itemCondition: data.itemCondition,
          location: data.location || undefined,
          comment: data.notes || undefined,
        },
      ],
    });

    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "owned_purchase.create_from_stock_form",
      entityType: "Purchase",
      entityId: created.purchase.id,
      after: {
        purchaseNumber: created.purchaseNumber,
        inventoryNumbers: created.lines.map((line) => line.inventoryNumber),
        title: data.title,
        grossCents,
        netCents,
        quantity: data.quantity,
        zm: data.paymentMethod,
      },
    });

    revalidatePath("/lager");
    revalidatePath("/produkte");
    if (created.debt) revalidatePath("/schulden");
    const inventoryText = created.lines.map((line) => line.inventoryNumber).join(", ");
    const debtHint = created.debt ? " · Schulden-Eintrag angelegt" : "";
    return {
      success: `Wareneingang ${created.purchaseNumber} gespeichert âœ“ (${inventoryText}, ${data.quantity} StÃ¼ck)${debtHint}`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Artikel konnte nicht gespeichert werden.",
    };
  }
}

export async function updateOwnedLotEntryStatusAction(
  ownedLotId: string,
  field: "purchaseEntryStatus" | "returnEntryStatus",
  value: EntryStatus
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(EntryStatus).safeParse(value);
  if (!parsed.success || !["purchaseEntryStatus", "returnEntryStatus"].includes(field)) {
    return { error: "UngÃ¼ltiger Wert." };
  }

  const lot = await db.ownedStockLot.findFirst({
    where: { id: ownedLotId },
    include: { inventoryPosition: true },
  });
  if (!lot) return { error: "Charge nicht gefunden." };

  await db.ownedStockLot.update({
    where: { id: ownedLotId },
    data: { [field]: parsed.data },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "owned_stock_lot.entry_status_change",
    entityType: "OwnedStockLot",
    entityId: ownedLotId,
    before: { [field]: lot[field] },
    after: {
      [field]: parsed.data,
      inventoryNumber: lot.inventoryPosition.inventoryNumber,
    },
  });

  revalidatePath("/lager");
  return { success: `Status von ${lot.inventoryPosition.inventoryNumber} geändert ✓` };
}

export async function toggleInventoryPositionListingAction(
  inventoryPositionId: string,
  platformId: string,
  listed: boolean
): Promise<ActionState> {
  const context = await requireOrg("MEMBER");
  const { db, organization } = context;

  const [position, platform] = await Promise.all([
    db.inventoryPosition.findFirst({
      where: { id: inventoryPositionId },
      select: { inventoryNumber: true, inventoryType: true },
    }),
    db.platform.findFirst({
      where: { id: platformId },
      select: { name: true },
    }),
  ]);
  if (!position || !platform) return { error: "Charge oder Plattform nicht gefunden." };

  if (position.inventoryType === "CONSIGNMENT") {
    try {
      await assertFeatureAccess(context, FEATURE_KEYS.CONSIGNMENT);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Konsignation ist für diese Organisation nicht aktiviert.",
      };
    }
  }

  if (listed) {
    await db.inventoryPositionListing.upsert({
      where: {
        inventoryPositionId_platformId: { inventoryPositionId, platformId },
      },
      create: {
        organizationId: organization.id,
        inventoryPositionId,
        platformId,
      },
      update: {},
    });
  } else {
    await db.inventoryPositionListing.deleteMany({
      where: { inventoryPositionId, platformId },
    });
  }

  revalidatePath("/lager");
  return {
    success: `${position.inventoryNumber}: ${platform.name} ${listed ? "gelistet" : "entfernt"} ✓`,
  };
}

const stockMetadataSchema = z.object({
  productName: z.string().trim().min(1, "Produktname fehlt.").max(300),
  variant: z.string().trim().max(200).optional(),
  size: z.string().trim().max(50).optional(),
  ean: z.string().trim().max(20).regex(/^\d*$/, "EAN darf nur Ziffern enthalten.").optional(),
  itemCondition: z.preprocess(
    (value) => value === "" ? null : value,
    z.nativeEnum(ItemCondition).nullable()
  ),
  imageUrls: z.string().max(100_000).optional(),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function parseStockMetadata(formData: FormData) {
  const parsed = stockMetadataSchema.safeParse({
    productName: formData.get("productName"),
    variant: String(formData.get("variant") ?? ""),
    size: String(formData.get("size") ?? ""),
    ean: String(formData.get("ean") ?? ""),
    itemCondition: formData.get("itemCondition") ?? "",
    imageUrls: String(formData.get("imageUrls") ?? ""),
    location: String(formData.get("location") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Metadaten." } as const;
  }
  try {
    const imageUrls = parseHttpUrlList(parsed.data.imageUrls);
    if (imageUrls.some((value) => {
      const url = new URL(value);
      return Boolean(url.username || url.password);
    })) {
      throw new Error("Bildadressen mit eingebetteten Zugangsdaten sind nicht erlaubt.");
    }
    return {
      data: {
        ...parsed.data,
        imageUrls,
      },
    } as const;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Ungültige Bildadresse.",
    } as const;
  }
}

export async function updateInventoryPositionMetadataAction(
  inventoryPositionId: string,
  _previous: StockMetadataActionState,
  formData: FormData
): Promise<StockMetadataActionState> {
  const trace = await createLagerPerformanceTrace("POST /lager metadata owned");
  return trace.run(async () => {
  const { db, organization, userId } = await requireOrg("MEMBER", trace);
  const parsed = trace.measureSync("validation.metadata", () => parseStockMetadata(formData));
  if ("error" in parsed) return { error: parsed.error };
  if (parsed.data.location) {
    const location = await trace.measureDb("validation.storage_location", () => db.selectOption.findFirst({
      where: { kind: "STORAGE_LOCATION", label: parsed.data.location },
      select: { id: true },
    }));
    if (!location) return { error: "Der gewählte Lagerstandort ist ungültig." };
  }

  try {
    const result = await updateInventoryPositionMetadata({
      organizationId: organization.id,
      inventoryPositionId,
      userId,
      productName: parsed.data.productName,
      variant: parsed.data.variant || null,
      size: parsed.data.size || null,
      ean: parsed.data.ean || null,
      itemCondition: parsed.data.itemCondition,
      imageUrls: parsed.data.imageUrls,
      location: parsed.data.location || null,
      notes: parsed.data.notes || null,
      performanceTrace: trace,
    });
    return {
      success: result.changed ? "Lagerposition gespeichert ✓" : "Keine Änderungen vorhanden.",
      rowPatch: stockMetadataPatch(inventoryPositionId, "owned", result.metadata),
    };
  } catch (error) {
    return {
      error: stockMetadataError(error),
    };
  }
  });
}

export async function updateLegacyStockItemMetadataAction(
  stockItemId: string,
  _previous: StockMetadataActionState,
  formData: FormData
): Promise<StockMetadataActionState> {
  const trace = await createLagerPerformanceTrace("POST /lager metadata legacy");
  return trace.run(async () => {
  const { db, organization, userId } = await requireOrg("MEMBER", trace);
  const parsed = trace.measureSync("validation.metadata", () => parseStockMetadata(formData));
  if ("error" in parsed) return { error: parsed.error };
  if (parsed.data.location) {
    const location = await trace.measureDb("validation.storage_location", () => db.selectOption.findFirst({
      where: { kind: "STORAGE_LOCATION", label: parsed.data.location },
      select: { id: true },
    }));
    if (!location) return { error: "Der gewählte Lagerstandort ist ungültig." };
  }

  try {
    const result = await updateLegacyStockItemMetadata({
      organizationId: organization.id,
      stockItemId,
      userId,
      productName: parsed.data.productName,
      variant: parsed.data.variant || null,
      size: parsed.data.size || null,
      ean: parsed.data.ean || null,
      itemCondition: parsed.data.itemCondition,
      imageUrls: parsed.data.imageUrls,
      location: parsed.data.location || null,
      notes: parsed.data.notes || null,
      performanceTrace: trace,
    });
    return {
      success: result.changed ? "Lagerposition gespeichert ✓" : "Keine Änderungen vorhanden.",
      rowPatch: stockMetadataPatch(stockItemId, "legacy", result.metadata),
    };
  } catch (error) {
    return {
      error: stockMetadataError(error),
    };
  }
  });
}

function stockMetadataPatch(
  id: string,
  source: "owned" | "legacy",
  metadata: {
    productName: string;
    variant: string | null;
    size: string | null;
    ean: string | null;
    itemCondition: ItemCondition | null;
    imageUrls: string[];
    location: string | null;
    notes: string | null;
  }
): StockMetadataPatch {
  return {
    id,
    source,
    title: metadata.productName,
    variant: metadata.variant ?? "",
    size: metadata.size ?? "",
    ean: metadata.ean ?? "",
    itemCondition: metadata.itemCondition,
    imageUrls: metadata.imageUrls,
    imageUrl: metadata.imageUrls[0] ?? null,
    location: metadata.location,
    notes: metadata.notes ?? "",
  };
}

function stockMetadataError(error: unknown): string {
  return error instanceof Error && error.name === "StockMetadataDomainError"
    ? error.message
    : "Lagerposition konnte nicht gespeichert werden.";
}

export interface StockHistoryPayload {
  metadata: {
    title: string;
    variant: string;
    size: string;
    ean: string;
    itemCondition: ItemCondition | null;
    imageUrls: string[];
    imageUrl: string | null;
    location: string | null;
    notes: string;
  };
  ownedDetails?: {
    purchaseNumber: string | null;
    returnableQuantity: number;
    receiptId: string | null;
    receiptCancelled: boolean;
    receiptLineCount: number;
    cancellableQuantity: number;
  };
  movements: Array<{
    id: string;
    movementType: InventoryMovementType;
    quantity: number;
    fromBucket: InventoryBucket | null;
    toBucket: InventoryBucket | null;
    comment: string | null;
    createdAt: string;
    actor: string;
  }>;
  auditLogs: Array<{
    id: string;
    createdAt: string;
    actor: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }>;
}

export async function loadStockHistoryAction(
  source: "owned" | "legacy",
  positionId: string
): Promise<{ data?: StockHistoryPayload; error?: string }> {
  const { db, organization } = await requireOrg();
  const entityType = source === "owned" ? "InventoryPosition" : "StockItem";
  const ownedPosition = source === "owned"
    ? await db.inventoryPosition.findFirst({
        where: { id: positionId, organizationId: organization.id },
        select: {
          id: true,
          inventoryNumber: true,
          itemCondition: true,
          location: true,
          notes: true,
          product: {
            select: {
              name: true,
              variant: true,
              size: true,
              ean: true,
              imageUrls: true,
            },
          },
          quantityAvailable: true,
          quantityInspection: true,
          quantityDefective: true,
          ownedLot: {
            select: {
              ean: true,
              imageUrls: true,
              purchaseLine: {
                select: { purchase: { select: { purchaseNumber: true } } },
              },
            },
          },
          purchaseReceiptLine: {
            select: {
              quantity: true,
              cancelledQuantity: true,
              inboundMovement: { select: { toBucket: true } },
              purchaseReceipt: {
                select: {
                  id: true,
                  cancelledAt: true,
                  _count: { select: { lines: true } },
                },
              },
            },
          },
          supplierReturnLines: {
            where: {
              outboundMovementId: null,
              sourceBucket: "AVAILABLE",
              supplierReturn: { status: { in: ACTIVE_SUPPLIER_RETURN_PLAN_STATUSES } },
            },
            select: { quantity: true, sourceBucket: true },
          },
        },
      })
    : null;
  const legacyItem = source === "legacy"
    ? await db.stockItem.findFirst({
        where: { id: positionId, organizationId: organization.id },
        select: {
          id: true,
          title: true,
          variant: true,
          size: true,
          ean: true,
          imageUrls: true,
          itemCondition: true,
          location: true,
          notes: true,
        },
      })
    : null;
  if (!ownedPosition && !legacyItem) return { error: "Lagerposition wurde nicht gefunden." };

  const [movements, auditLogs] = await Promise.all([
    source === "owned"
      ? db.inventoryMovement.findMany({
          where: {
            organizationId: organization.id,
            inventoryPositionId: positionId,
          },
          include: { createdBy: { select: { name: true, email: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 30,
        })
      : Promise.resolve([]),
    db.auditLog.findMany({
      where: {
        organizationId: organization.id,
        entityType,
        entityId: positionId,
        action: source === "owned"
          ? "inventory_position.updated"
          : { in: ["inventory_position.updated", "stock_item.status_change"] },
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
    }),
  ]);

  return {
    data: {
      metadata: ownedPosition
        ? ownedStockMetadata(ownedPosition)
        : legacyStockMetadata(legacyItem!),
      ...(ownedPosition
        ? { ownedDetails: ownedStockDetails(ownedPosition) }
        : {}),
      movements: movements.map((movement) => ({
        id: movement.id,
        movementType: movement.movementType,
        quantity: movement.quantity,
        fromBucket: movement.fromBucket,
        toBucket: movement.toBucket,
        comment: movement.comment,
        createdAt: movement.createdAt.toLocaleString("de-DE"),
        actor: movement.createdBy?.name ?? movement.createdBy?.email ?? "System",
      })),
      auditLogs: auditLogs.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt.toLocaleString("de-DE"),
        actor: entry.user?.name ?? entry.user?.email ?? "System",
        before: jsonObject(entry.before),
        after: jsonObject(entry.after),
      })),
    },
  };
}

function ownedStockMetadata(position: {
  inventoryNumber: string;
  itemCondition: ItemCondition | null;
  location: string | null;
  notes: string | null;
  product: {
    name: string;
    variant: string | null;
    size: string | null;
    ean: string | null;
    imageUrls: string[];
  };
  ownedLot: { ean: string | null; imageUrls: string[] } | null;
}): StockHistoryPayload["metadata"] {
  const imageUrls = [
    ...new Set([
      ...(position.ownedLot?.imageUrls ?? []),
      ...position.product.imageUrls,
    ]),
  ];
  return {
    title: position.product.name,
    variant: position.product.variant ?? "",
    size: position.product.size ?? "",
    ean: position.ownedLot?.ean ?? position.product.ean ?? "",
    itemCondition: position.itemCondition,
    imageUrls,
    imageUrl: imageUrls[0] ?? null,
    location: position.location,
    notes: position.notes ?? "",
  };
}

function legacyStockMetadata(item: {
  title: string;
  variant: string | null;
  size: string | null;
  ean: string | null;
  imageUrls: string[];
  itemCondition: ItemCondition | null;
  location: string | null;
  notes: string | null;
}): StockHistoryPayload["metadata"] {
  return {
    title: item.title,
    variant: item.variant ?? "",
    size: item.size ?? "",
    ean: item.ean ?? "",
    itemCondition: item.itemCondition,
    imageUrls: item.imageUrls,
    imageUrl: item.imageUrls[0] ?? null,
    location: item.location,
    notes: item.notes ?? "",
  };
}

function ownedStockDetails(position: {
  inventoryNumber: string;
  itemCondition: ItemCondition | null;
  location: string | null;
  notes: string | null;
  product: {
    name: string;
    variant: string | null;
    size: string | null;
    ean: string | null;
    imageUrls: string[];
  };
  quantityAvailable: number;
  quantityInspection: number;
  quantityDefective: number;
  ownedLot: {
    ean: string | null;
    imageUrls: string[];
    purchaseLine: { purchase: { purchaseNumber: string } } | null;
  } | null;
  purchaseReceiptLine: {
    quantity: number;
    cancelledQuantity: number;
    inboundMovement: { toBucket: InventoryBucket | null };
    purchaseReceipt: {
      id: string;
      cancelledAt: Date | null;
      _count: { lines: number };
    };
  } | null;
  supplierReturnLines: Array<{ quantity: number; sourceBucket: InventoryBucket }>;
}): NonNullable<StockHistoryPayload["ownedDetails"]> {
  const receiptLine = position.purchaseReceiptLine;
  const bucketQuantity = receiptLine?.inboundMovement.toBucket === "AVAILABLE"
    ? position.quantityAvailable
    : receiptLine?.inboundMovement.toBucket === "INSPECTION"
      ? position.quantityInspection
      : receiptLine?.inboundMovement.toBucket === "DEFECTIVE"
        ? position.quantityDefective
        : 0;
  return {
    purchaseNumber: position.ownedLot?.purchaseLine?.purchase.purchaseNumber ?? null,
    returnableQuantity: calculateSupplierReturnableQuantity(
      position.quantityAvailable,
      position.supplierReturnLines
    ),
    receiptId: receiptLine?.purchaseReceipt.id ?? null,
    receiptCancelled: Boolean(receiptLine?.purchaseReceipt.cancelledAt),
    receiptLineCount: receiptLine?.purchaseReceipt._count.lines ?? 0,
    cancellableQuantity: receiptLine
      ? Math.min(receiptLine.quantity - receiptLine.cancelledQuantity, bucketQuantity)
      : 0,
  };
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}


/** Status eines Artikels Ã¤ndern (Inline-Dropdown). */
export async function updateStockItemStatusAction(
  stockItemId: string,
  status: StockItemStatus
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(StockItemStatus).safeParse(status);
  if (!parsed.success) return { error: "UngÃ¼ltiger Status." };

  const item = await db.stockItem.findFirst({ where: { id: stockItemId } });
  if (!item) return { error: "Artikel nicht gefunden." };

  await db.stockItem.update({
    where: { id: stockItemId },
    data: { status: parsed.data },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "stock_item.status_change",
    entityType: "StockItem",
    entityId: stockItemId,
    before: { status: item.status },
    after: { status: parsed.data },
  });

  revalidatePath("/lager");
  return { success: `Status von ${item.sku} geÃ¤ndert âœ“` };
}

/** Kauf-/Retoure-Buchungsstatus Ã¤ndern (Inline-Dropdown). */
export async function updateEntryStatusAction(
  stockItemId: string,
  field: "kaufStatus" | "retoureStatus",
  value: EntryStatus
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(EntryStatus).safeParse(value);
  if (!parsed.success || !["kaufStatus", "retoureStatus"].includes(field)) {
    return { error: "UngÃ¼ltiger Wert." };
  }

  const item = await db.stockItem.findFirst({ where: { id: stockItemId } });
  if (!item) return { error: "Artikel nicht gefunden." };

  await db.stockItem.update({
    where: { id: stockItemId },
    data: { [field]: parsed.data },
  });

  revalidatePath("/lager");
  return {
    success: `${field === "kaufStatus" ? "Kauf" : "Retoure"}-Status von ${item.sku} geÃ¤ndert âœ“`,
  };
}

/** Listing-Marker (Plattform-Checkbox) einzeln umschalten. */
export async function toggleListingAction(
  stockItemId: string,
  platformId: string,
  listed: boolean
): Promise<ActionState> {
  const { db, organization } = await requireOrg("MEMBER");

  const [item, platform] = await Promise.all([
    db.stockItem.findFirst({ where: { id: stockItemId } }),
    db.platform.findFirst({ where: { id: platformId } }),
  ]);
  if (!item || !platform) return { error: "Artikel oder Plattform nicht gefunden." };

  if (listed) {
    await db.stockItemListing.upsert({
      where: { stockItemId_platformId: { stockItemId, platformId } },
      create: { organizationId: organization.id, stockItemId, platformId },
      update: {},
    });
  } else {
    await db.stockItemListing.deleteMany({ where: { stockItemId, platformId } });
  }

  revalidatePath("/lager");
  return {
    success: `${item.sku}: ${platform.name} ${listed ? "gelistet" : "entfernt"} âœ“`,
  };
}

const bulkPatchSchema = z.object({
  status: z.nativeEnum(StockItemStatus).optional(),
  kaufStatus: z.nativeEnum(EntryStatus).optional(),
  retoureStatus: z.nativeEnum(EntryStatus).optional(),
  platformId: z.string().optional(),
  platformListed: z.boolean().optional(),
});

export type BulkStockPatch = z.infer<typeof bulkPatchSchema>;

/** Mehrfachbearbeitung: Patch auf alle markierten Zeilen anwenden. */
export async function bulkUpdateStockAction(
  stockItemIds: string[],
  patch: BulkStockPatch
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const ids = z.array(z.string().min(1)).min(1).max(500).safeParse(stockItemIds);
  const parsedPatch = bulkPatchSchema.safeParse(patch);
  if (!ids.success || !parsedPatch.success) return { error: "UngÃ¼ltige Auswahl." };
  const p = parsedPatch.data;

  // Nur Artikel der eigenen Organisation (Tenant-Kontext + ExistenzprÃ¼fung)
  const items = await db.stockItem.findMany({ where: { id: { in: ids.data } } });
  if (items.length === 0) return { error: "Keine passenden Artikel gefunden." };
  const itemIds = items.map((i) => i.id);

  const fieldPatch: Record<string, unknown> = {};
  if (p.status) fieldPatch.status = p.status;
  if (p.kaufStatus) fieldPatch.kaufStatus = p.kaufStatus;
  if (p.retoureStatus) fieldPatch.retoureStatus = p.retoureStatus;

  if (Object.keys(fieldPatch).length > 0) {
    await db.stockItem.updateMany({
      where: { id: { in: itemIds } },
      data: fieldPatch,
    });
  }

  if (p.platformId && p.platformListed !== undefined) {
    const platform = await db.platform.findFirst({ where: { id: p.platformId } });
    if (!platform) return { error: "Plattform nicht gefunden." };
    if (p.platformListed) {
      await db.stockItemListing.createMany({
        data: itemIds.map((stockItemId) => ({
          organizationId: organization.id,
          stockItemId,
          platformId: platform.id,
        })),
        skipDuplicates: true,
      });
    } else {
      await db.stockItemListing.deleteMany({
        where: { stockItemId: { in: itemIds }, platformId: platform.id },
      });
    }
  }

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "stock_item.bulk_update",
    entityType: "StockItem",
    after: { count: itemIds.length, patch: p },
  });

  revalidatePath("/lager");
  return { success: `${itemIds.length} Artikel aktualisiert âœ“` };
}

export async function loadStockReceiptProductOptionsAction(): Promise<{
  products?: Array<{
    id: string;
    name: string;
    variant: string | null;
    size: string | null;
    ean: string | null;
    category: string | null;
    defaultPriceCents: number | null;
  }>;
  error?: string;
}> {
  const trace = await createLagerPerformanceTrace("POST /lager receipt options");
  return trace.run(async () => {
  try {
    const { db } = await requireOrg("MEMBER", trace);
    const products = await trace.measureDb("query.receipt_product_options", () => db.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        variant: true,
        size: true,
        ean: true,
        category: true,
        defaultPriceCents: true,
      },
      take: 500,
    }));
    return { products };
  } catch {
    return { error: "Produkte konnten nicht geladen werden." };
  }
  });
}

