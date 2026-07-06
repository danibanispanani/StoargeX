"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EntryStatus, StockItemStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { calcPurchaseNetCents, euroToCents } from "@/lib/calculations";
import { paymentMethodCreatesDebt } from "@/lib/constants";
import { saveImage } from "@/lib/uploads";
import type { ActionState } from "@/lib/actions/team";

const stockItemSchema = z.object({
  purchaseDate: z.string().optional().or(z.literal("")),
  supplier: z.string().max(200).optional().or(z.literal("")), // Händler
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
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." } as const;
  }
  let grossCents: number;
  try {
    grossCents = euroToCents(parsed.data.priceGross);
  } catch {
    return { error: "Ungültiger Brutto-Preis." } as const;
  }
  return { data: parsed.data, grossCents } as const;
}

/** LagerID im Format L-{JJ}-{NNN}. */
function formatLagerId(counter: number, date: Date): string {
  return `L-${String(date.getFullYear()).slice(-2)}-${String(counter).padStart(3, "0")}`;
}

/**
 * Wareneingang erfassen. Menge > 1 erzeugt separate Einträge mit
 * fortlaufenden LagerIDs (jede Einheit hat eigenen Status/Listing/Verkauf).
 * ZM außerhalb "Firma…" legt automatisch einen Schulden-Eintrag an.
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
    return { error: "Mindestens eine gewählte Plattform ist ungültig." };
  }

  const netCents = calcPurchaseNetCents(
    grossCents,
    data.inputTaxDeductible,
    data.inputTaxRatePercent
  );
  const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : new Date();

  try {
    const skus = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;

      // Fortlaufende LagerIDs atomar reservieren
      const org = await tx.organization.update({
        where: { id: organization.id },
        data: { stockIdCounter: { increment: data.quantity } },
      });
      const firstCounter = org.stockIdCounter - data.quantity + 1;

      const created: string[] = [];
      for (let i = 0; i < data.quantity; i++) {
        const sku = formatLagerId(firstCounter + i, purchaseDate);
        await tx.stockItem.create({
          data: {
            organizationId: organization.id,
            sku,
            title: data.title,
            variant: data.variant || null,
            size: data.size || null,
            ean: data.ean || null,
            supplier: data.supplier || null,
            purchaseDate,
            purchasePriceCents: grossCents,
            purchaseNetCents: netCents,
            inputTaxDeductible: data.inputTaxDeductible,
            paymentMethod: data.paymentMethod,
            kaufStatus: data.kaufStatus,
            retoureStatus: data.retoureStatus,
            status: data.status,
            quantity: 1,
            notes: data.notes || null,
            imageUrls,
            listings: {
              create: platforms.map((p) => ({
                organizationId: organization.id,
                platformId: p.id,
              })),
            },
          },
        });
        created.push(sku);
      }

      // Automatik: ZM Richard/Daniel -> Schulden-Eintrag (GbR schuldet Person)
      if (paymentMethodCreatesDebt(data.paymentMethod)) {
        await tx.debt.create({
          data: {
            organizationId: organization.id,
            debtDate: purchaseDate,
            refId: created.join(", "), // LagerID(s)
            description: [data.title, data.variant].filter(Boolean).join(" "),
            kind: "KAUF",
            quantity: data.quantity,
            amountCents: grossCents * data.quantity,
            debtorName: "GbR",
            creditorName: data.paymentMethod,
            status: "OPEN",
            entryStatus: "IO",
          },
        });
      }

      return created;
    });

    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "stock_item.create",
      entityType: "StockItem",
      after: { skus, title: data.title, grossCents, zm: data.paymentMethod },
    });

    revalidatePath("/lager");
    revalidatePath("/schulden");
    const skuText = skus.length === 1 ? skus[0] : `${skus[0]} – ${skus[skus.length - 1]}`;
    const debtHint = paymentMethodCreatesDebt(data.paymentMethod)
      ? " · Schulden-Eintrag angelegt"
      : "";
    return {
      success: `Artikel ${skuText} eingetragen ✓ (${skus.length} Einheit(en))${debtHint}`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Artikel konnte nicht gespeichert werden.",
    };
  }
}

/** Einzelnen Lagereintrag vollständig bearbeiten. */
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
    return { error: "Mindestens eine gewählte Plattform ist ungültig." };
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
  return { success: `Artikel ${existing.sku} gespeichert ✓` };
}

/** Lagereintrag loeschen, solange er noch nicht in einem Verkauf verwendet wird. */
export async function deleteStockItemAction(stockItemId: string): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.stockItem.findFirst({
    where: { id: stockItemId },
    select: { id: true, sku: true, title: true, status: true },
  });
  if (!existing) return { error: "Artikel nicht gefunden." };

  const [saleItems, legacySales] = await Promise.all([
    db.saleItem.count({ where: { stockItemId } }),
    db.sale.count({ where: { stockItemId } }),
  ]);
  if (saleItems > 0 || legacySales > 0 || existing.status === "SOLD") {
    return {
      error:
        "Dieser Artikel ist mit einem Verkauf verknuepft und kann nicht geloescht werden.",
    };
  }

  await db.stockItem.delete({ where: { id: stockItemId } });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "stock_item.delete",
    entityType: "StockItem",
    entityId: stockItemId,
    before: { sku: existing.sku, title: existing.title, status: existing.status },
  });

  revalidatePath("/lager");
  revalidatePath("/dashboard");
  return { success: `Artikel ${existing.sku} geloescht.` };
}

/** Status eines Artikels ändern (Inline-Dropdown). */
export async function updateStockItemStatusAction(
  stockItemId: string,
  status: StockItemStatus
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(StockItemStatus).safeParse(status);
  if (!parsed.success) return { error: "Ungültiger Status." };

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
  return { success: `Status von ${item.sku} geändert ✓` };
}

/** Kauf-/Retoure-Buchungsstatus ändern (Inline-Dropdown). */
export async function updateEntryStatusAction(
  stockItemId: string,
  field: "kaufStatus" | "retoureStatus",
  value: EntryStatus
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(EntryStatus).safeParse(value);
  if (!parsed.success || !["kaufStatus", "retoureStatus"].includes(field)) {
    return { error: "Ungültiger Wert." };
  }

  const item = await db.stockItem.findFirst({ where: { id: stockItemId } });
  if (!item) return { error: "Artikel nicht gefunden." };

  await db.stockItem.update({
    where: { id: stockItemId },
    data: { [field]: parsed.data },
  });

  revalidatePath("/lager");
  return {
    success: `${field === "kaufStatus" ? "Kauf" : "Retoure"}-Status von ${item.sku} geändert ✓`,
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
    success: `${item.sku}: ${platform.name} ${listed ? "gelistet" : "entfernt"} ✓`,
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
  if (!ids.success || !parsedPatch.success) return { error: "Ungültige Auswahl." };
  const p = parsedPatch.data;

  // Nur Artikel der eigenen Organisation (Tenant-Kontext + Existenzprüfung)
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
  return { success: `${itemIds.length} Artikel aktualisiert ✓` };
}
