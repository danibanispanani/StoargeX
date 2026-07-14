"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import { euroToCents } from "@/lib/calculations";
import { saveImage } from "@/lib/uploads";
import type { ActionState } from "@/lib/actions/team";
import type { TableSelection } from "@/lib/operational-table";
import {
  buildProductSelectionWhere,
  parseProductTableQuery,
} from "@/lib/products/product-table";

const productSchema = z.object({
  name: z.string().min(1, "Name fehlt.").max(300),
  variant: z.string().max(200).optional().or(z.literal("")),
  brand: z.string().max(100).optional().or(z.literal("")),
  category: z.string().max(100).optional().or(z.literal("")),
  ean: z.string().max(20).regex(/^\d*$/, "EAN darf nur Ziffern enthalten.").optional().or(z.literal("")),
  defaultPrice: z.string().optional().or(z.literal("")),
  size: z.string().max(100).optional().or(z.literal("")),
  defaultCondition: z.enum(["NEW", "OPEN_BOX", "REFURBISHED", "USED", "DEFECTIVE"]).optional().or(z.literal("")),
  defaultShippingCost: z.string().optional().or(z.literal("")),
  defaultPackagingCost: z.string().optional().or(z.literal("")),
  ebayFeeCategoryId: z.string().optional().or(z.literal("")),
  kauflandFeeCategoryId: z.string().optional().or(z.literal("")),
});

function parseProductForm(formData: FormData) {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    variant: formData.get("variant"),
    brand: formData.get("brand"),
    category: formData.get("category"),
    ean: formData.get("ean"),
    defaultPrice: formData.get("defaultPrice"),
    size: formData.get("size"),
    defaultCondition: formData.get("defaultCondition") ?? "",
    defaultShippingCost: formData.get("defaultShippingCost") ?? "",
    defaultPackagingCost: formData.get("defaultPackagingCost") ?? "",
    ebayFeeCategoryId: formData.get("ebayFeeCategoryId") ?? "",
    kauflandFeeCategoryId: formData.get("kauflandFeeCategoryId") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." } as const;
  }
  let defaultPriceCents: number | null = null;
  if (parsed.data.defaultPrice?.trim()) {
    try {
      defaultPriceCents = euroToCents(parsed.data.defaultPrice);
    } catch {
      return { error: "Ungültiger Standard-EK." } as const;
    }
  }
  let defaultShippingCostCents: number | null = null;
  let defaultPackagingCostCents: number | null = null;
  try {
    defaultShippingCostCents = parsed.data.defaultShippingCost?.trim() ? euroToCents(parsed.data.defaultShippingCost) : null;
    defaultPackagingCostCents = parsed.data.defaultPackagingCost?.trim() ? euroToCents(parsed.data.defaultPackagingCost) : null;
  } catch {
    return { error: "Ungültige Versand- oder Verpackungskosten." } as const;
  }
  return { data: parsed.data, defaultPriceCents, defaultShippingCostCents, defaultPackagingCostCents, hasMarketplaceMappingFields: formData.has("ebayFeeCategoryId") || formData.has("kauflandFeeCategoryId") } as const;
}

/** Katalogprodukt anlegen. */
export async function createProductAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const result = parseProductForm(formData);
  if ("error" in result) return { error: result.error };
  const { data, defaultPriceCents, defaultShippingCostCents, defaultPackagingCostCents, hasMarketplaceMappingFields } = result;

  let imageUrls: string[] = [];
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imageUrls = [await saveImage(image, organization.id)];
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Bild-Upload fehlgeschlagen." };
    }
  }

  const existing = await db.product.findFirst({
    where: { name: data.name, variant: data.variant || null },
  });
  if (existing) return { error: "Dieses Produkt existiert bereits im Katalog." };

  const product = await db.product.create({
    data: {
      organizationId: organization.id,
      name: data.name,
      variant: data.variant || null,
      brand: data.brand || null,
      category: data.category || null,
      ean: data.ean || null,
      defaultPriceCents,
      imageUrls,
      size: data.size || null,
      defaultCondition: data.defaultCondition || null,
      defaultShippingCostCents,
      defaultPackagingCostCents,
    },
  });
  if (hasMarketplaceMappingFields) {
    const mappingError = await saveProductMarketplaceMappings(db, product.id, data.ebayFeeCategoryId, data.kauflandFeeCategoryId, userId);
    if (mappingError) return { error: mappingError };
  }

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "product.create",
    entityType: "Product",
    entityId: product.id,
    after: { name: product.name, variant: product.variant },
  });

  revalidatePath("/produkte");
  return { success: `Produkt "${product.name}" angelegt ✓` };
}

/** Katalogprodukt bearbeiten. */
export async function updateProductAction(
  productId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.product.findFirst({ where: { id: productId } });
  if (!existing) return { error: "Produkt nicht gefunden." };

  const result = parseProductForm(formData);
  if ("error" in result) return { error: result.error };
  const { data, defaultPriceCents, defaultShippingCostCents, defaultPackagingCostCents, hasMarketplaceMappingFields } = result;

  let imageUrls = existing.imageUrls;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imageUrls = [await saveImage(image, organization.id)];
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Bild-Upload fehlgeschlagen." };
    }
  }

  await db.product.update({
    where: { id: productId },
    data: {
      name: data.name,
      variant: data.variant || null,
      brand: data.brand || null,
      category: data.category || null,
      ean: data.ean || null,
      defaultPriceCents,
      imageUrls,
      size: data.size || null,
      defaultCondition: data.defaultCondition || null,
      defaultShippingCostCents,
      defaultPackagingCostCents,
    },
  });
  if (hasMarketplaceMappingFields) {
    const mappingError = await saveProductMarketplaceMappings(db, productId, data.ebayFeeCategoryId, data.kauflandFeeCategoryId, userId);
    if (mappingError) return { error: mappingError };
  }

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "product.update",
    entityType: "Product",
    entityId: productId,
    before: { name: existing.name },
    after: { name: data.name },
  });

  revalidatePath("/produkte");
  return { success: `Produkt "${data.name}" gespeichert ✓` };
}

async function saveProductMarketplaceMappings(
  db: Awaited<ReturnType<typeof requireOrg>>["db"],
  productId: string,
  ebayFeeCategoryId: string | undefined,
  kauflandFeeCategoryId: string | undefined,
  userId: string
) {
  for (const [marketplaceCode, feeCategoryId] of [["EBAY_DE", ebayFeeCategoryId], ["KAUFLAND_DE", kauflandFeeCategoryId]] as const) {
    if (!feeCategoryId) {
      await db.productMarketplaceMapping.deleteMany({ where: { productId, marketplaceCode } });
      continue;
    }
    const category = await db.feeCategory.findFirst({ where: { id: feeCategoryId, marketplaceCode, feeSchedule: { status: "ACTIVE" } } });
    if (!category) return `Die gewählte ${marketplaceCode === "EBAY_DE" ? "eBay" : "Kaufland"}-Kategorie ist nicht aktiv.`;
    await db.productMarketplaceMapping.upsert({
      where: { productId_marketplaceCode: { productId, marketplaceCode } },
      create: { organizationId: category.organizationId, productId, marketplaceCode, feeCategoryId: category.id, status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId },
      update: { feeCategoryId: category.id, status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId },
    });
  }
  await db.marketplacePricingCalculation.updateMany({ where: { productId }, data: { stale: true } });
  return null;
}

/** Katalogprodukt löschen (Lager-/Verkaufsdaten bleiben unberührt). */
export async function deleteProductAction(productId: string): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const existing = await db.product.findFirst({
    where: { id: productId },
    include: {
      _count: {
        select: {
          purchaseLines: true,
          inventoryPositions: true,
          saleLines: true,
        },
      },
    },
  });
  if (!existing) return { error: "Produkt nicht gefunden." };

  const referenceCount =
    existing._count.purchaseLines +
    existing._count.inventoryPositions +
    existing._count.saleLines;
  if (referenceCount > 0) {
    return {
      error: `Produkt wird noch in ${referenceCount} Datensatz/Datensätzen verwendet und kann nicht gelöscht werden.`,
    };
  }

  await db.product.delete({ where: { id: productId } });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "product.delete",
    entityType: "Product",
    entityId: productId,
    before: { name: existing.name },
  });

  revalidatePath("/produkte");
  return { success: `Produkt "${existing.name}" gelöscht ✓` };
}

const bulkCategorySchema = z.object({
  category: z.string().trim().min(1, "Kategorie fehlt.").max(100),
  expectedCount: z.number().int().min(1).max(5000),
  expectedResultDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  selection: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("explicit"), ids: z.array(z.string().min(1)).max(5000) }),
    z.object({ mode: z.literal("all"), excludedIds: z.array(z.string().min(1)).max(5000) }),
  ]),
  query: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string())])
  ),
});

export interface BulkCategorizeProductsInput {
  category: string;
  expectedCount: number;
  expectedResultDigest?: string;
  selection: TableSelection;
  query: Record<string, string | string[] | undefined>;
}

/** Ordnet eine serverseitig erneut aufgelöste, tenant-gescoppte Treffermenge einer Kategorie zu. */
export async function bulkCategorizeProductsAction(
  input: BulkCategorizeProductsInput
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");
  const parsed = bulkCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Auswahl." };
  }

  const query = parseProductTableQuery(parsed.data.query);
  const where = buildProductSelectionWhere(
    query,
    parsed.data.selection,
    organization.lowStockThreshold
  );
  const products = await db.product.findMany({
    where,
    select: { id: true, category: true },
    take: 5001,
  });
  if (products.length === 0) {
    return { error: "Keine gültigen Produkte ausgewählt." };
  }
  if (products.length > 5000) {
    return { error: "Bulk-Aktion ist auf 5000 Produkte begrenzt. Filtere die Ansicht weiter ein." };
  }
  if (products.length !== parsed.data.expectedCount) {
    return {
      error: "Die Ergebnismenge hat sich seit der Auswahl geändert. Bitte Auswahl aktualisieren und erneut bestätigen.",
    };
  }
  if (parsed.data.selection.mode === "all") {
    if (!parsed.data.expectedResultDigest) {
      return { error: "Die Ergebnismenge muss vor der Bulk-Aktion neu geladen werden." };
    }
    const resultDigest = createHash("sha256")
      .update(products.map((product) => product.id).sort().join("\n"))
      .digest("hex");
    if (resultDigest !== parsed.data.expectedResultDigest) {
      return {
        error: "Die Ergebnismenge hat sich seit der Auswahl geändert. Bitte Auswahl aktualisieren und erneut bestätigen.",
      };
    }
  }

  const ids = products
    .filter((product) => product.category !== parsed.data.category)
    .map((product) => product.id);
  if (ids.length === 0) {
    return { success: "Alle ausgewählten Produkte sind bereits dieser Kategorie zugeordnet." };
  }
  const result = await db.product.updateMany({
    where: { id: { in: ids } },
    data: { category: parsed.data.category },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "product.bulk_categorize",
    entityType: "Product",
    entityId: ids[0],
    after: {
      category: parsed.data.category,
      count: result.count,
      productIds: ids.slice(0, 100),
      productIdsTruncated: ids.length > 100,
    },
  });

  revalidatePath("/produkte");
  return {
    success: `${result.count} Produkt${result.count === 1 ? "" : "e"} der Kategorie „${parsed.data.category}“ zugeordnet ✓`,
  };
}

const bulkMarketplaceCategorySchema = bulkCategorySchema.omit({ category: true }).extend({
  marketplaceCode: z.enum(["EBAY_DE", "KAUFLAND_DE"]),
  feeCategoryId: z.string().min(1),
});

export async function bulkMapProductsToMarketplaceCategoryAction(input: {
  marketplaceCode: "EBAY_DE" | "KAUFLAND_DE";
  feeCategoryId: string;
  expectedCount: number;
  expectedResultDigest?: string;
  selection: TableSelection;
  query: Record<string, string | string[] | undefined>;
}): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");
  const parsed = bulkMarketplaceCategorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Auswahl." };
  const category = await db.feeCategory.findFirst({ where: { id: parsed.data.feeCategoryId, marketplaceCode: parsed.data.marketplaceCode, feeSchedule: { status: "ACTIVE" } } });
  if (!category) return { error: "Aktive Gebührenkategorie nicht gefunden." };
  const query = parseProductTableQuery(parsed.data.query);
  const where = buildProductSelectionWhere(query, parsed.data.selection, organization.lowStockThreshold);
  const products = await db.product.findMany({ where, select: { id: true }, orderBy: { id: "asc" }, take: 5001 });
  if (products.length === 0 || products.length > 5000 || products.length !== parsed.data.expectedCount) return { error: "Die Ergebnismenge hat sich geändert. Bitte Auswahl neu laden." };
  if (parsed.data.selection.mode === "all") {
    const digest = createHash("sha256").update(products.map((item) => item.id).join("\n")).digest("hex");
    if (!parsed.data.expectedResultDigest || digest !== parsed.data.expectedResultDigest) return { error: "Die Ergebnismenge hat sich geändert. Bitte Auswahl neu laden." };
  }
  for (const product of products) {
    await db.productMarketplaceMapping.upsert({
      where: { productId_marketplaceCode: { productId: product.id, marketplaceCode: parsed.data.marketplaceCode } },
      create: { organizationId: organization.id, productId: product.id, marketplaceCode: parsed.data.marketplaceCode, feeCategoryId: category.id, status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId },
      update: { feeCategoryId: category.id, status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId },
    });
  }
  await db.marketplacePricingCalculation.updateMany({ where: { productId: { in: products.map((item) => item.id) }, marketplaceCode: parsed.data.marketplaceCode }, data: { stale: true } });
  await writeAuditLog({ organizationId: organization.id, userId, action: "product.bulk_marketplace_category", entityType: "ProductMarketplaceMapping", after: { marketplaceCode: parsed.data.marketplaceCode, feeCategoryId: category.id, count: products.length } });
  revalidatePath("/produkte");
  return { success: `${products.length} Produkte ${parsed.data.marketplaceCode === "EBAY_DE" ? "eBay" : "Kaufland"} zugeordnet ✓` };
}
