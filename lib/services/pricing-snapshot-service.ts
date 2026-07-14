import { createHash } from "crypto";

export interface ProductPricingSource {
  id: string;
  name: string;
  brand: string | null;
  variant: string | null;
  size: string | null;
  ean: string | null;
  defaultPriceCents: number | null;
  defaultCondition: string | null;
  defaultShippingCostCents: number | null;
  defaultPackagingCostCents: number | null;
  lastReferenceSalePriceCents: number | null;
  mappings: ReadonlyArray<{ marketplaceCode: string; categoryId: string; status: string }>;
}

export function buildProductPricingDefaults(product: ProductPricingSource, marketplaceCode: string) {
  const mapping = product.mappings.find((item) => item.marketplaceCode === marketplaceCode);
  return {
    productId: product.id,
    productName: product.name,
    brand: product.brand,
    variant: product.variant,
    size: product.size,
    ean: product.ean,
    purchasePriceCents: product.defaultPriceCents,
    condition: product.defaultCondition,
    shippingCents: product.defaultShippingCostCents,
    packagingCents: product.defaultPackagingCostCents,
    referenceSalePriceCents: product.lastReferenceSalePriceCents,
    categoryId: mapping?.categoryId ?? null,
    categoryMappingStatus: mapping?.status ?? "UNASSIGNED",
  };
}

export function createPricingSnapshotFingerprint(input: Record<string, unknown>): string {
  return createHash("sha256").update(stableRelevantJson(input)).digest("hex");
}

export function isPricingSnapshotStale(fingerprint: string, current: Record<string, unknown>): boolean {
  return fingerprint !== createPricingSnapshotFingerprint(current);
}

function stableRelevantJson(input: Record<string, unknown>) {
  const relevantKeys = [
    "productId",
    "purchasePriceCents",
    "categoryId",
    "condition",
    "shippingCents",
    "packagingCents",
    "marketplaceAccountId",
    "feeCatalogId",
    "feeRuleIds",
  ];
  return JSON.stringify(
    Object.fromEntries(relevantKeys.map((key) => [key, normalize(input[key])]))
  );
}

function normalize(value: unknown): unknown {
  return Array.isArray(value) ? [...value].sort() : value ?? null;
}
