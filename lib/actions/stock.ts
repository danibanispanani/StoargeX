"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EntryStatus, InventoryBucket, StockItemStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { calcPurchaseNetCents, euroToCents } from "@/lib/calculations";
import { saveImage } from "@/lib/uploads";
import { createOwnedPurchase } from "@/lib/services/owned-purchase-service";
import { adjust } from "@/lib/services/inventory-service";
import type { ActionState } from "@/lib/actions/team";

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
  kaufStatus: z.nativeEnum(EntryStatus).default("O"),
  retoureStatus: z.nativeEnum(EntryStatus).default("NN"),
  status: z.nativeEnum(StockItemStatus).default("IN_STOCK"),
  ean: z.string().max(20).regex(/^\d*$/, "EAN darf nur Ziffern enthalten.").optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(500).default(1),
  notes: z.string().max(2000).optional().or(z.literal("")),
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
    kaufStatus: formData.get("kaufStatus") || "O",
    retoureStatus: formData.get("retoureStatus") || "NN",
    status: formData.get("status") || "IN_STOCK",
    ean: formData.get("ean"),
    quantity: formData.get("quantity") || 1,
    notes: formData.get("notes"),
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

  let imageUrls: string[] = [];
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imageUrls = [await saveImage(image, organization.id)];
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Bild-Upload fehlgeschlagen." };
    }
  }

  const platforms = data.platformIds.length
    ? await db.platform.findMany({ where: { id: { in: data.platformIds } } })
    : [];
  if (platforms.length !== data.platformIds.length) {
    return { error: "Mindestens eine gewÃ¤hlte Plattform ist ungÃ¼ltig." };
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
          purchaseEntryStatus: data.kaufStatus,
          returnEntryStatus: data.retoureStatus,
          platformIds: platforms.map((p) => p.id),
          imageUrls,
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
  return { success: `Status von \${lot.inventoryPosition.inventoryNumber} geÃ¤ndert âœ“` };
}

export async function toggleInventoryPositionListingAction(
  inventoryPositionId: string,
  platformId: string,
  listed: boolean
): Promise<ActionState> {
  const { db, organization } = await requireOrg("MEMBER");

  const [position, platform] = await Promise.all([
    db.inventoryPosition.findFirst({ where: { id: inventoryPositionId } }),
    db.platform.findFirst({ where: { id: platformId } }),
  ]);
  if (!position || !platform) return { error: "Charge oder Plattform nicht gefunden." };

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
    success: `\${position.inventoryNumber}: \${platform.name} \${listed ? "gelistet" : "entfernt"} âœ“`,
  };
}

const inventoryAdjustmentSchema = z.object({
  direction: z.enum(["IN", "OUT"]),
  bucket: z.nativeEnum(InventoryBucket).default("AVAILABLE"),
  quantity: z.coerce.number().int().min(1).max(500),
  comment: z.string().min(1, "Grund/Kommentar fehlt.").max(500),
});

export async function adjustOwnedInventoryQuantityAction(
  inventoryPositionId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = inventoryAdjustmentSchema.safeParse({
    direction: formData.get("direction"),
    bucket: formData.get("bucket") || "AVAILABLE",
    quantity: formData.get("quantity"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "UngÃ¼ltige Korrektur." };
  }

  const position = await db.inventoryPosition.findFirst({
    where: { id: inventoryPositionId, inventoryType: "OWNED" },
  });
  if (!position) return { error: "Charge nicht gefunden." };

  try {
    await adjust({
      organizationId: organization.id,
      inventoryPositionId,
      quantity: parsed.data.quantity,
      direction: parsed.data.direction,
      bucket: parsed.data.bucket,
      comment: parsed.data.comment,
      referenceType: "ManualStockAdjustment",
      referenceId: inventoryPositionId,
      referenceAction: parsed.data.direction === "IN" ? "adjustment_in" : "adjustment_out",
      idempotencyKey: `manual-adjust:\${inventoryPositionId}:\${Date.now()}`,
      createdById: userId,
      requiredInventoryType: "OWNED",
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Bestand konnte nicht korrigiert werden.",
    };
  }

  revalidatePath("/lager");
  return { success: `Bestand von \${position.inventoryNumber} korrigiert âœ“` };
}


/** Einzelnen Lagereintrag vollstÃ¤ndig bearbeiten. */
export async function updateStockItemAction(
  stockItemId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.stockItem.findFirst({
    where: { id: stockItemId },
    include: { listings: true },
  });
  if (!existing) return { error: "Artikel nicht gefunden." };

  const result = parseStockForm(formData);
  if ("error" in result) return { error: result.error };
  const { data, grossCents } = result;

  let imageUrls = existing.imageUrls;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imageUrls = [await saveImage(image, organization.id)];
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Bild-Upload fehlgeschlagen." };
    }
  }

  const platforms = data.platformIds.length
    ? await db.platform.findMany({ where: { id: { in: data.platformIds } } })
    : [];
  if (platforms.length !== data.platformIds.length) {
    return { error: "Mindestens eine gewÃ¤hlte Plattform ist ungÃ¼ltig." };
  }

  const netCents = calcPurchaseNetCents(
    grossCents,
    data.inputTaxDeductible,
    data.inputTaxRatePercent
  );

  await db.stockItem.update({
    where: { id: stockItemId },
    data: {
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : existing.purchaseDate,
      supplier: data.supplier || null,
      title: data.title,
      variant: data.variant || null,
      size: data.size || null,
      ean: data.ean || null,
      purchasePriceCents: grossCents,
      purchaseNetCents: netCents,
      inputTaxDeductible: data.inputTaxDeductible,
      paymentMethod: data.paymentMethod,
      kaufStatus: data.kaufStatus,
      retoureStatus: data.retoureStatus,
      status: data.status,
      notes: data.notes || null,
      imageUrls,
    },
  });

  // Listings synchronisieren
  await db.stockItemListing.deleteMany({ where: { stockItemId } });
  if (platforms.length > 0) {
    await db.stockItemListing.createMany({
      data: platforms.map((p) => ({
        organizationId: organization.id,
        stockItemId,
        platformId: p.id,
      })),
    });
  }

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "stock_item.update",
    entityType: "StockItem",
    entityId: stockItemId,
    before: { title: existing.title, status: existing.status },
    after: { title: data.title, status: data.status },
  });

  revalidatePath("/lager");
  return { success: `Artikel ${existing.sku} gespeichert âœ“` };
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

