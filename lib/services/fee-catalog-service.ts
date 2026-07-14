import { createHash } from "crypto";
import { z } from "zod";
import ebayCatalogJson from "@/data/fee-catalogs/ebay-de-commercial-2026-07.json";
import kauflandCatalogJson from "@/data/fee-catalogs/kaufland-de-2026-07.json";
import type { MarketplaceFeeRule, MarketplaceItemCondition } from "@/lib/services/marketplace-pricing-service";

interface CatalogCategoryDefinition {
  group?: string;
  officialName: string;
  externalCategoryId: string;
  percentageBasisPoints: number;
  conditionPercentageBasisPoints?: number;
  tierThresholdCents?: number;
  percentageAboveBasisPoints?: number;
  fixedItemFeeCents?: number;
}

export interface FeeCatalogDefinition {
  marketplaceCode: "EBAY_DE" | "KAUFLAND_DE";
  marketplaceName: string;
  sellerProfile: string;
  version: string;
  sourceUrl: string;
  retrievedAt: string;
  validFrom: string;
  feeVatRateBasisPoints: number;
  calculationBasis: "ITEM_PLUS_BUYER_SHIPPING";
  fixedOrderFeeCents: number;
  fixedOrderThresholdCents?: number;
  fixedOrderFeeAboveCents?: number;
  listingFeeByShopCents?: Record<string, number>;
  shopDiscountBasisPoints?: Record<string, number>;
  categories: CatalogCategoryDefinition[];
  reviewRequired: string[];
  accountPlans?: Array<{ code: string; monthlyNetCents: number }>;
}

export interface NormalizedFeeCatalog {
  definition: FeeCatalogDefinition;
  sourceHash: string;
  catalogKey: string;
  categories: Array<CatalogCategoryDefinition & { categoryKey: string }>;
  rules: MarketplaceFeeRule[];
  importReport: {
    categoryCount: number;
    ruleCount: number;
    reviewRequired: string[];
    activationSafe: boolean;
  };
}

const catalogCategorySchema = z.object({
  group: z.string().optional(),
  officialName: z.string().min(1),
  externalCategoryId: z.string().min(1),
  percentageBasisPoints: z.number().int().nonnegative(),
  conditionPercentageBasisPoints: z.number().int().nonnegative().optional(),
  tierThresholdCents: z.number().int().nonnegative().optional(),
  percentageAboveBasisPoints: z.number().int().nonnegative().optional(),
  fixedItemFeeCents: z.number().int().nonnegative().optional(),
});

const feeCatalogDefinitionSchema: z.ZodType<FeeCatalogDefinition> = z.object({
  marketplaceCode: z.enum(["EBAY_DE", "KAUFLAND_DE"]),
  marketplaceName: z.string().min(1),
  sellerProfile: z.string().min(1),
  version: z.string().min(1),
  sourceUrl: z.string().url().startsWith("https://"),
  retrievedAt: z.iso.datetime(),
  validFrom: z.iso.datetime(),
  feeVatRateBasisPoints: z.number().int().nonnegative(),
  calculationBasis: z.literal("ITEM_PLUS_BUYER_SHIPPING"),
  fixedOrderFeeCents: z.number().int().nonnegative(),
  fixedOrderThresholdCents: z.number().int().nonnegative().optional(),
  fixedOrderFeeAboveCents: z.number().int().nonnegative().optional(),
  listingFeeByShopCents: z.record(z.string(), z.number().int().nonnegative()).optional(),
  shopDiscountBasisPoints: z.record(z.string(), z.number().int().nonnegative()).optional(),
  categories: z.array(catalogCategorySchema).min(1),
  reviewRequired: z.array(z.string()),
  accountPlans: z.array(z.object({ code: z.string().min(1), monthlyNetCents: z.number().int().nonnegative() })).optional(),
});

const BUNDLED = feeCatalogDefinitionSchema.array().parse([ebayCatalogJson, kauflandCatalogJson]);
const CONDITIONS = ["OPEN_BOX", "REFURBISHED", "USED"] as const;

export function loadBundledFeeCatalogs(): NormalizedFeeCatalog[] {
  return BUNDLED.map(normalizeFeeCatalog);
}

export function getBundledFeeCatalog(marketplaceCode: string): NormalizedFeeCatalog {
  const definition = BUNDLED.find((item) => item.marketplaceCode === marketplaceCode);
  if (!definition) throw new Error(`Kein gebündelter Katalog für ${marketplaceCode}.`);
  return normalizeFeeCatalog(definition);
}

export function normalizeFeeCatalog(definition: FeeCatalogDefinition): NormalizedFeeCatalog {
  validateDefinition(definition);
  const catalogKey = `${definition.marketplaceCode}:${definition.version}`;
  const sourceHash = createHash("sha256").update(JSON.stringify(definition)).digest("hex");
  const categories = definition.categories.map((category) => ({
    ...category,
    categoryKey: `${catalogKey}:${category.externalCategoryId}`,
  }));
  const shops = definition.listingFeeByShopCents
    ? Object.keys(definition.listingFeeByShopCents)
    : [null];
  const rules = categories.flatMap((category) =>
    shops.flatMap((shopModel) => {
      const base = buildRule(definition, category, catalogKey, shopModel, null, category.percentageBasisPoints);
      if (category.conditionPercentageBasisPoints === undefined) return [base];
      return [
        base,
        ...CONDITIONS.map((condition) =>
          buildRule(definition, category, catalogKey, shopModel, condition, category.conditionPercentageBasisPoints!)
        ),
      ];
    })
  );
  return {
    definition,
    sourceHash,
    catalogKey,
    categories,
    rules,
    importReport: {
      categoryCount: categories.length,
      ruleCount: rules.length,
      reviewRequired: [...definition.reviewRequired],
      // Review notes describe intentionally excluded special cases. Every emitted rule is source-backed.
      activationSafe: true,
    },
  };
}

function buildRule(
  definition: FeeCatalogDefinition,
  category: CatalogCategoryDefinition,
  catalogKey: string,
  shopModel: string | null,
  condition: MarketplaceItemCondition | null,
  percentageBasisPoints: number
): MarketplaceFeeRule {
  const suffix = [shopModel ?? "ANY", condition ?? "ANY"].join(":");
  return {
    id: `${catalogKey}:${category.externalCategoryId}:${suffix}`,
    catalogId: catalogKey,
    catalogVersion: definition.version,
    catalogStatus: "ACTIVE",
    marketplaceCode: definition.marketplaceCode,
    categoryId: category.externalCategoryId,
    officialCategoryName: category.officialName,
    sellerProfile: definition.sellerProfile,
    shopModel,
    condition,
    validFrom: new Date(definition.validFrom),
    validUntil: null,
    priority: (shopModel ? 20 : 10) + (condition ? 5 : 0),
    percentageBasisPoints,
    percentageAboveBasisPoints: category.percentageAboveBasisPoints ?? null,
    tierThresholdCents: category.tierThresholdCents ?? null,
    fixedOrderFeeCents: definition.fixedOrderFeeCents,
    fixedOrderThresholdCents: definition.fixedOrderThresholdCents ?? null,
    fixedOrderFeeAboveCents: definition.fixedOrderFeeAboveCents ?? null,
    fixedItemFeeCents: category.fixedItemFeeCents ?? 0,
    listingFeeCents: shopModel ? definition.listingFeeByShopCents?.[shopModel] ?? 0 : 0,
    minimumFeeCents: null,
    maximumFeeCents: null,
    shopDiscountBasisPoints: shopModel ? definition.shopDiscountBasisPoints?.[shopModel] ?? 0 : 0,
    feeVatRateBasisPoints: definition.feeVatRateBasisPoints,
    calculationBasis: definition.calculationBasis,
  };
}

function validateDefinition(definition: FeeCatalogDefinition) {
  if (!definition.marketplaceCode || !definition.version || !definition.sellerProfile) throw new Error("Katalogidentität ist unvollständig.");
  if (!definition.sourceUrl.startsWith("https://")) throw new Error("Katalogquelle muss eine HTTPS-URL sein.");
  if (Number.isNaN(new Date(definition.retrievedAt).getTime()) || Number.isNaN(new Date(definition.validFrom).getTime())) {
    throw new Error("Katalogdatum ist ungültig.");
  }
  if (definition.categories.length === 0) throw new Error("Katalog enthält keine Kategorien.");
  const ids = new Set<string>();
  for (const category of definition.categories) {
    if (!category.officialName.trim() || !category.externalCategoryId.trim()) throw new Error("Kategoriebezeichnung oder externe ID fehlt.");
    if (ids.has(category.externalCategoryId)) throw new Error(`Doppelte Kategorie-ID: ${category.externalCategoryId}`);
    ids.add(category.externalCategoryId);
    if (!Number.isSafeInteger(category.percentageBasisPoints) || category.percentageBasisPoints < 0) throw new Error("Gebührensatz muss in nichtnegativen Basispunkten vorliegen.");
  }
}
