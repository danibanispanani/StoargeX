"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { calculateMarketplacePrice, findBreakEven } from "@/lib/services/marketplace-pricing-service";
import { createPricingSnapshotFingerprint } from "@/lib/services/pricing-snapshot-service";
import { mapFeeRuleProjection } from "@/lib/services/marketplace-pricing-query-service";
import { writeAuditLog } from "@/lib/audit";

const saveSchema = z.object({
  marketplaceCode: z.enum(["EBAY_DE", "KAUFLAND_DE"]),
  inputMode: z.enum(["PRODUCT", "FREE"]),
  productId: z.string().min(1).nullable(),
  marketplaceAccountId: z.string().min(1),
  feeCategoryId: z.string().min(1),
  condition: z.enum(["NEW", "OPEN_BOX", "REFURBISHED", "USED", "DEFECTIVE"]).nullable(),
  purchasePriceCents: z.number().int().min(0),
  purchasePriceMode: z.enum(["GROSS", "NET"]),
  salePriceCents: z.number().int().min(0),
  buyerShippingCents: z.number().int().min(0),
  ownShippingCents: z.number().int().min(0),
  packagingCents: z.number().int().min(0),
  otherDirectCostsCents: z.number().int().min(0),
  quantity: z.number().int().min(1).max(10000),
  listingFeeMode: z.enum(["AUTO", "YES", "NO"]),
  promotedListingBasisPoints: z.number().int().min(0).max(10000),
  internationalFeeBasisPoints: z.number().int().min(0).max(10000),
  manualPlatformFeeGrossCents: z.number().int().min(0).optional(),
  priceSource: z.enum(["EBAY", "IDEALO", "KAUFLAND", "EXPERIENCE", "OTHER"]).nullable(),
  status: z.enum(["IDEA", "REVIEW", "INTERESTING", "REJECTED", "PURCHASED", "CONVERTED_TO_PRODUCT"]),
  note: z.string().max(1000).nullable(),
});

export type SaveMarketplacePricingInput = z.infer<typeof saveSchema>;

export async function saveMarketplacePricingAction(raw: SaveMarketplacePricingInput) {
  const { db, organization, userId, membership } = await requireOrg("MEMBER");
  if (membership.role === "READONLY") return { error: "Nur Mitglieder mit Schreibrecht dürfen Kalkulationen speichern." };
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Kalkulation." };
  const data = parsed.data;
  const [account, category, defaultTaxRate, product] = await Promise.all([
    db.marketplaceAccount.findFirst({ where: { id: data.marketplaceAccountId, active: true } }),
    db.feeCategory.findFirst({ where: { id: data.feeCategoryId, marketplaceCode: data.marketplaceCode } }),
    db.taxRate.findFirst({ where: { isDefault: true }, orderBy: { updatedAt: "desc" } }),
    data.productId ? db.product.findFirst({ where: { id: data.productId }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (!account || account.marketplaceCode !== data.marketplaceCode) return { error: "Marktplatzkonto nicht gefunden." };
  if (!category?.externalCategoryId) return { error: "Gebührenkategorie nicht gefunden." };
  if (data.productId && !product) return { error: "Produkt nicht gefunden." };
  const schedule = await db.feeSchedule.findFirst({
    where: { id: category.feeScheduleId, marketplaceCode: data.marketplaceCode, status: "ACTIVE" },
    include: {
      rules: {
        where: { feeCategoryId: category.id, active: true },
        include: { feeCategory: true, feeSchedule: true },
      },
    },
  });
  if (!schedule) return { error: "Kein aktiver Gebührenkatalog für diese Kategorie." };
  const rules = schedule.rules.map(mapFeeRuleProjection).filter((item) => item !== null);
  const taxProfile = account.taxProfile ?? organization.taxProfile;
  const vatRegistered = taxProfile === "VAT_REGISTERED";
  const saleTaxRateBasisPoints = vatRegistered ? Math.round(Number(defaultTaxRate?.ratePercent ?? 19) * 100) : 0;
  const inputTaxDeductible = vatRegistered && organization.inputTaxDeductible;
  const calculatedAt = new Date();
  const pricingInput = {
    marketplaceCode: data.marketplaceCode,
    marketplaceAccountId: account.id,
    sellerProfile: account.sellerProfile ?? schedule.sellerProfile ?? "",
    shopModel: account.shopModel,
    categoryId: category.externalCategoryId,
    condition: data.condition,
    calculatedAt,
    purchasePriceCents: data.purchasePriceCents,
    purchasePriceMode: data.purchasePriceMode,
    purchaseTaxRateBasisPoints: 1900,
    inputTaxDeductible,
    salePriceCents: data.salePriceCents,
    buyerShippingCents: data.buyerShippingCents,
    ownShippingCents: data.ownShippingCents,
    packagingCents: data.packagingCents,
    otherDirectCostsCents: data.otherDirectCostsCents,
    quantity: data.quantity,
    saleTaxRateBasisPoints,
    listingFeeMode: data.listingFeeMode,
    promotedListingBasisPoints: data.promotedListingBasisPoints,
    internationalFeeBasisPoints: data.internationalFeeBasisPoints,
    manualPlatformFeeGrossCents: data.manualPlatformFeeGrossCents,
    rules,
  } as const;
  let result;
  let breakEven;
  try {
    result = calculateMarketplacePrice(pricingInput);
    breakEven = findBreakEven(pricingInput);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Kalkulation fehlgeschlagen." };
  }
  const fingerprintInput = {
    productId: data.productId,
    purchasePriceCents: data.purchasePriceCents,
    categoryId: category.id,
    condition: data.condition,
    shippingCents: data.ownShippingCents,
    packagingCents: data.packagingCents,
    marketplaceAccountId: account.id,
    feeCatalogId: schedule.id,
    feeRuleIds: [result.ruleId],
  };
  const calculation = await db.marketplacePricingCalculation.create({
    data: {
      organizationId: organization.id,
      productId: data.productId,
      marketplaceAccountId: account.id,
      feeScheduleId: schedule.id,
      feeCategoryId: category.id,
      marketplaceCode: data.marketplaceCode,
      inputMode: data.inputMode,
      status: data.status,
      itemCondition: data.condition,
      purchasePriceCents: data.purchasePriceCents,
      expectedSalePriceCents: data.salePriceCents,
      priceSource: data.priceSource,
      inputSnapshot: {
        marketplaceCode: data.marketplaceCode,
        inputMode: data.inputMode,
        productId: data.productId,
        marketplaceAccountId: data.marketplaceAccountId,
        feeCategoryId: data.feeCategoryId,
        condition: data.condition,
        purchasePriceCents: data.purchasePriceCents,
        purchasePriceMode: data.purchasePriceMode,
        salePriceCents: data.salePriceCents,
        buyerShippingCents: data.buyerShippingCents,
        ownShippingCents: data.ownShippingCents,
        packagingCents: data.packagingCents,
        otherDirectCostsCents: data.otherDirectCostsCents,
        quantity: data.quantity,
        listingFeeMode: data.listingFeeMode,
        promotedListingBasisPoints: data.promotedListingBasisPoints,
        internationalFeeBasisPoints: data.internationalFeeBasisPoints,
        manualPlatformFeeGrossCents: data.manualPlatformFeeGrossCents ?? null,
        priceSource: data.priceSource,
        status: data.status,
        note: data.note,
        calculatedAt: calculatedAt.toISOString(),
        saleTaxRateBasisPoints,
        inputTaxDeductible,
      } satisfies Prisma.InputJsonObject,
      feeBreakdown: result.fees,
      feeRuleIds: [result.ruleId],
      profitCents: result.profitCents,
      marginCents: result.grossMarginCents,
      marginBasisPoints: result.grossMarginBasisPoints,
      breakEvenCents: breakEven.salePriceCents,
      expectedPayoutCents: result.expectedPayoutCents,
      fingerprint: createPricingSnapshotFingerprint(fingerprintInput),
      note: data.note,
      calculatedAt,
    },
  });
  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "marketplace_pricing.save",
    entityType: "MarketplacePricingCalculation",
    entityId: calculation.id,
    after: { marketplaceCode: data.marketplaceCode, productId: data.productId, profitCents: result.profitCents },
  });
  revalidatePath("/produkte");
  revalidatePath(`/finanzen/preisrechner/${data.marketplaceCode === "EBAY_DE" ? "ebay" : "kaufland"}`);
  return { success: "Kalkulation gespeichert ✓", calculationId: calculation.id };
}

export async function convertPricingCalculationToProductAction(calculationId: string, productName: string) {
  const { db, organization, userId, membership } = await requireOrg("MEMBER");
  if (membership.role === "READONLY") return { error: "Nur Mitglieder mit Schreibrecht dürfen Produkte anlegen." };
  const name = productName.trim();
  if (!name || name.length > 300) return { error: "Bitte einen gültigen Produktnamen angeben." };
  const calculation = await db.marketplacePricingCalculation.findFirst({ where: { id: calculationId }, include: { feeCategory: true } });
  if (!calculation) return { error: "Kalkulation nicht gefunden." };
  if (calculation.productId) return { error: "Diese Kalkulation ist bereits einem Produkt zugeordnet." };
  const [activeCategory, activeAccount] = await Promise.all([
    calculation.feeCategory.externalCategoryId
      ? db.feeCategory.findFirst({
          where: {
            marketplaceCode: calculation.marketplaceCode,
            externalCategoryId: calculation.feeCategory.externalCategoryId,
            feeSchedule: { status: "ACTIVE" },
          },
        })
      : Promise.resolve(null),
    calculation.marketplaceAccountId
      ? db.marketplaceAccount.findFirst({ where: { id: calculation.marketplaceAccountId, active: true } })
      : Promise.resolve(null),
  ]);
  if (!activeCategory || !activeAccount) return { error: "Für die Produktübernahme fehlen eine aktive Kategorieversion oder ein aktives Marktplatzkonto." };
  const existing = await db.product.findFirst({ where: { name, variant: null } });
  if (existing) return { error: "Ein Produkt mit diesem Namen existiert bereits." };
  const product = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
    const created = await tx.product.create({ data: { organizationId: organization.id, name, defaultPriceCents: calculation.purchasePriceCents, defaultCondition: calculation.itemCondition, lastReferenceSalePriceCents: calculation.expectedSalePriceCents } });
    await tx.productMarketplaceMapping.create({ data: { organizationId: organization.id, productId: created.id, marketplaceCode: calculation.marketplaceCode, feeCategoryId: activeCategory.id, marketplaceAccountId: activeAccount.id, status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId } });
    await tx.marketplacePricingCalculation.update({ where: { id: calculation.id }, data: { productId: created.id, inputMode: "PRODUCT", status: "CONVERTED_TO_PRODUCT" } });
    return created;
  });
  await writeAuditLog({ organizationId: organization.id, userId, action: "marketplace_pricing.convert_to_product", entityType: "Product", entityId: product.id, after: { calculationId: calculation.id, marketplaceCode: calculation.marketplaceCode } });
  revalidatePath("/produkte");
  return { success: `Produkt „${name}“ angelegt ✓`, productId: product.id };
}

export async function updateProductFromPricingAction(raw: SaveMarketplacePricingInput) {
  const { db, organization, userId, membership } = await requireOrg("MEMBER");
  if (membership.role === "READONLY") return { error: "Nur Mitglieder mit Schreibrecht dürfen Produktdaten ändern." };
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { error: "Produktkalkulation ist unvollständig." };
  const data = parsed.data;
  const productId = data.productId;
  if (!productId) return { error: "Produktkalkulation ist unvollständig." };
  const [product, category, account] = await Promise.all([
    db.product.findFirst({ where: { id: productId } }),
    db.feeCategory.findFirst({ where: { id: data.feeCategoryId, marketplaceCode: data.marketplaceCode, feeSchedule: { status: "ACTIVE" } } }),
    db.marketplaceAccount.findFirst({ where: { id: data.marketplaceAccountId, marketplaceCode: data.marketplaceCode, active: true } }),
  ]);
  if (!product || !category || !account) return { error: "Produkt, aktive Gebührenkategorie oder Marktplatzkonto nicht gefunden." };
  await db.product.update({ where: { id: product.id }, data: { defaultPriceCents: data.purchasePriceCents, defaultCondition: data.condition, defaultShippingCostCents: data.ownShippingCents, defaultPackagingCostCents: data.packagingCents, lastReferenceSalePriceCents: data.salePriceCents } });
  await db.productMarketplaceMapping.upsert({
    where: { productId_marketplaceCode: { productId: product.id, marketplaceCode: data.marketplaceCode } },
    create: { organizationId: organization.id, productId: product.id, marketplaceCode: data.marketplaceCode, feeCategoryId: category.id, marketplaceAccountId: data.marketplaceAccountId, status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId },
    update: { feeCategoryId: category.id, marketplaceAccountId: data.marketplaceAccountId, status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId },
  });
  await db.marketplacePricingCalculation.updateMany({ where: { productId: product.id }, data: { stale: true } });
  await writeAuditLog({ organizationId: organization.id, userId, action: "product.update_from_pricing", entityType: "Product", entityId: product.id, before: { defaultPriceCents: product.defaultPriceCents }, after: { defaultPriceCents: data.purchasePriceCents, marketplaceCode: data.marketplaceCode, feeCategoryId: category.id } });
  revalidatePath("/produkte");
  return { success: "Produktdefaults ausdrücklich aktualisiert ✓" };
}

const persistedPricingSnapshotSchema = saveSchema.extend({
  manualPlatformFeeGrossCents: z.number().int().min(0).nullable().optional(),
});

const recalculationSchema = z.object({
  marketplaceCode: z.enum(["EBAY_DE", "KAUFLAND_DE"]),
  productIds: z.array(z.string().min(1)).max(5000).optional(),
  staleOnly: z.boolean().default(false),
}).refine((data) => data.staleOnly || Boolean(data.productIds?.length), {
  message: "Für eine Neuberechnung muss eine Produktauswahl oder ‚nur veraltete‘ gesetzt sein.",
});

/**
 * Erzeugt neue, historische Snapshots aus bestätigten Produktdefaults.
 * Bestehende Kalkulationen werden nie überschrieben oder gelöscht.
 */
export async function recalculateProductPricingAction(raw: {
  marketplaceCode: "EBAY_DE" | "KAUFLAND_DE";
  productIds?: string[];
  staleOnly?: boolean;
}) {
  const context = await requireOrg("MEMBER");
  if (context.membership.role === "READONLY") return { error: "Nur Mitglieder mit Schreibrecht dürfen Kalkulationen neu berechnen." };
  const parsed = recalculationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Neuberechnung." };
  const { marketplaceCode, productIds, staleOnly } = parsed.data;
  const products = await context.db.product.findMany({
    where: {
      ...(productIds ? { id: { in: [...new Set(productIds)] } } : {}),
      ...(staleOnly ? { pricingCalculations: { some: { marketplaceCode, stale: true } } } : {}),
    },
    select: {
      id: true,
      defaultPriceCents: true,
      defaultCondition: true,
      defaultShippingCostCents: true,
      defaultPackagingCostCents: true,
      marketplaceMappings: {
        where: { marketplaceCode },
        select: { feeCategoryId: true, marketplaceAccountId: true, status: true },
        take: 1,
      },
      pricingCalculations: {
        where: { marketplaceCode },
        orderBy: { calculatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          marketplaceAccountId: true,
          expectedSalePriceCents: true,
          priceSource: true,
          status: true,
          note: true,
          inputSnapshot: true,
        },
      },
    },
    orderBy: { id: "asc" },
    take: 5001,
  });
  if (products.length > 5000) return { error: "Mehr als 5000 betroffene Produkte. Bitte die Neuberechnung in kleineren Mengen ausführen." };
  if (products.length === 0) return { error: staleOnly ? "Keine veralteten Produktkalkulationen gefunden." : "Keine Produkte gefunden." };

  let recalculated = 0;
  const incomplete: Array<{ productId: string; missing: string[] }> = [];
  for (const product of products) {
    const mapping = product.marketplaceMappings[0];
    const latest = product.pricingCalculations[0];
    const snapshot = latest ? persistedPricingSnapshotSchema.safeParse(latest.inputSnapshot) : null;
    const missing: string[] = [];
    if (product.defaultPriceCents === null) missing.push("Einkaufspreis");
    if (product.defaultCondition === null) missing.push("Zustand");
    if (product.defaultShippingCostCents === null) missing.push("Versandkosten");
    if (product.defaultPackagingCostCents === null) missing.push("Verpackungskosten");
    if (!mapping || mapping.status !== "CONFIRMED") missing.push("bestätigte Marktplatzkategorie");
    if (!latest || !snapshot?.success) missing.push("vorherige Kalkulationsbasis");
    const marketplaceAccountId = mapping?.marketplaceAccountId ?? latest?.marketplaceAccountId ?? null;
    if (!marketplaceAccountId) missing.push("Marktplatzkonto");
    if (missing.length > 0 || !mapping || !latest || !snapshot?.success || !marketplaceAccountId || product.defaultPriceCents === null || product.defaultCondition === null || product.defaultShippingCostCents === null || product.defaultPackagingCostCents === null) {
      incomplete.push({ productId: product.id, missing });
      continue;
    }
    const previous = snapshot.data;
    const response = await saveMarketplacePricingAction({
      marketplaceCode,
      inputMode: "PRODUCT",
      productId: product.id,
      marketplaceAccountId,
      feeCategoryId: mapping.feeCategoryId,
      condition: marketplaceCode === "EBAY_DE" ? product.defaultCondition : null,
      purchasePriceCents: product.defaultPriceCents,
      purchasePriceMode: previous.purchasePriceMode,
      salePriceCents: latest.expectedSalePriceCents,
      buyerShippingCents: previous.buyerShippingCents,
      ownShippingCents: product.defaultShippingCostCents,
      packagingCents: product.defaultPackagingCostCents,
      otherDirectCostsCents: previous.otherDirectCostsCents,
      quantity: previous.quantity,
      listingFeeMode: previous.listingFeeMode,
      promotedListingBasisPoints: previous.promotedListingBasisPoints,
      internationalFeeBasisPoints: previous.internationalFeeBasisPoints,
      manualPlatformFeeGrossCents: previous.manualPlatformFeeGrossCents ?? undefined,
      priceSource: latest.priceSource,
      status: latest.status,
      note: latest.note,
    });
    if (response.error || !response.calculationId) {
      incomplete.push({ productId: product.id, missing: [response.error ?? "Neuberechnung fehlgeschlagen"] });
      continue;
    }
    await context.db.marketplacePricingCalculation.updateMany({
      where: { productId: product.id, marketplaceCode, id: { not: response.calculationId } },
      data: { stale: true },
    });
    recalculated += 1;
  }
  revalidatePath("/produkte");
  revalidatePath("/finanzen/gebuehren");
  if (recalculated === 0) {
    const first = incomplete[0];
    return { error: `Keine Kalkulation konnte aktualisiert werden${first ? `; es fehlen: ${first.missing.join(", ")}` : ""}.`, incomplete };
  }
  return {
    success: `${recalculated} Produktkalkulation${recalculated === 1 ? "" : "en"} neu erstellt${incomplete.length ? `; ${incomplete.length} unvollständig` : ""} ✓`,
    recalculated,
    incomplete,
  };
}
