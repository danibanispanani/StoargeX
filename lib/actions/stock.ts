"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { StockItemStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { calcPurchaseNetCents, euroToCents } from "@/lib/calculations";
import type { ActionState } from "@/lib/actions/team";

const euroString = z
  .string()
  .min(1, "Betrag fehlt.")
  .refine((v) => {
    try {
      euroToCents(v);
      return true;
    } catch {
      return false;
    }
  }, "Ungültiger Betrag.");

const stockItemSchema = z.object({
  title: z.string().min(1, "Bezeichnung fehlt.").max(300),
  model: z.string().max(200).optional().or(z.literal("")),
  variant: z.string().max(200).optional().or(z.literal("")),
  size: z.string().max(50).optional().or(z.literal("")),
  ean: z.string().max(20).regex(/^\d*$/, "EAN darf nur Ziffern enthalten.").optional().or(z.literal("")),
  supplier: z.string().max(200).optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  priceGross: euroString,
  inputTaxDeductible: z.coerce.boolean(),
  inputTaxRatePercent: z.coerce.number().min(0).max(100).default(19),
  paymentMethod: z.string().max(100).optional().or(z.literal("")),
  status: z.nativeEnum(StockItemStatus).default("IN_STOCK"),
  quantity: z.coerce.number().int().min(1).max(100000).default(1),
  consignmentRefId: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  platformIds: z.array(z.string().min(1)).default([]),
});

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function saveImage(file: File, orgId: string): Promise<string> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Nur JPG, PNG oder WebP erlaubt.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Bild ist größer als 5 MB.");

  const dir = path.join(process.cwd(), "public", "uploads", orgId);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${orgId}/${filename}`;
}

/** Wareneingang erfassen. */
export async function createStockItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = stockItemSchema.safeParse({
    title: formData.get("title"),
    model: formData.get("model"),
    variant: formData.get("variant"),
    size: formData.get("size"),
    ean: formData.get("ean"),
    supplier: formData.get("supplier"),
    purchaseDate: formData.get("purchaseDate"),
    priceGross: formData.get("priceGross"),
    inputTaxDeductible: formData.get("inputTaxDeductible") === "on",
    inputTaxRatePercent: formData.get("inputTaxRatePercent") || 19,
    paymentMethod: formData.get("paymentMethod"),
    status: formData.get("status") || "IN_STOCK",
    quantity: formData.get("quantity") || 1,
    consignmentRefId: formData.get("consignmentRefId"),
    notes: formData.get("notes"),
    platformIds: formData.getAll("platformIds").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;

  // Bild-Upload (optional)
  let imageUrls: string[] = [];
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imageUrls = [await saveImage(image, organization.id)];
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Bild-Upload fehlgeschlagen." };
    }
  }

  // "Gelistet auf": nur Plattformen der eigenen Organisation zulassen
  const platforms = data.platformIds.length
    ? await db.platform.findMany({ where: { id: { in: data.platformIds } } })
    : [];
  if (platforms.length !== data.platformIds.length) {
    return { error: "Mindestens eine gewählte Plattform ist ungültig." };
  }

  const grossCents = euroToCents(data.priceGross);
  const netCents = calcPurchaseNetCents(
    grossCents,
    data.inputTaxDeductible,
    data.inputTaxRatePercent
  );

  // Automatische SKU: A-<Base36-Zeitstempel> (eindeutig je Organisation)
  const sku = `A-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;

  const item = await db.stockItem.create({
    data: {
      organizationId: organization.id,
      sku,
      title: data.title,
      model: data.model || null,
      variant: data.variant || null,
      size: data.size || null,
      ean: data.ean || null,
      supplier: data.supplier || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      purchasePriceCents: grossCents,
      purchaseNetCents: netCents,
      inputTaxDeductible: data.inputTaxDeductible,
      paymentMethod: data.paymentMethod || null,
      quantity: data.quantity,
      status: platforms.length > 0 && data.status === "IN_STOCK" ? "LISTED" : data.status,
      consignmentRefId: data.consignmentRefId || null,
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

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "stock_item.create",
    entityType: "StockItem",
    entityId: item.id,
    after: { sku: item.sku, title: item.title, grossCents },
  });

  revalidatePath("/lager");
  return { success: `Artikel ${item.sku} erfasst.` };
}

/** Status eines Artikels ändern. */
export async function updateStockItemStatusAction(
  stockItemId: string,
  status: StockItemStatus
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(StockItemStatus).safeParse(status);
  if (!parsed.success) return { error: "Ungültiger Status." };

  // findFirst im Tenant-Kontext stellt sicher, dass der Artikel zur Org gehört
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
  return { success: "Status aktualisiert." };
}

/** "Gelistet auf" eines Artikels aktualisieren. */
export async function updateStockItemListingsAction(
  stockItemId: string,
  platformIds: string[]
): Promise<ActionState> {
  const { db, organization } = await requireOrg("MEMBER");

  const parsed = z.array(z.string().min(1)).max(50).safeParse(platformIds);
  if (!parsed.success) return { error: "Ungültige Plattform-Auswahl." };

  const item = await db.stockItem.findFirst({ where: { id: stockItemId } });
  if (!item) return { error: "Artikel nicht gefunden." };

  const platforms = parsed.data.length
    ? await db.platform.findMany({ where: { id: { in: parsed.data } } })
    : [];
  if (platforms.length !== parsed.data.length) {
    return { error: "Mindestens eine gewählte Plattform ist ungültig." };
  }

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

  revalidatePath("/lager");
  return { success: "Listings aktualisiert." };
}
