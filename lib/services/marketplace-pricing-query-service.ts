import type { FeeCatalogStatus, ItemCondition, Prisma } from "@prisma/client";
import type { MarketplaceFeeRule } from "@/lib/services/marketplace-pricing-service";

export interface FeeRuleProjection {
  id: string;
  sellerProfile: string | null;
  shopModel: string | null;
  itemCondition: ItemCondition | null;
  validFrom: Date;
  validUntil: Date | null;
  priority: number;
  percentage: Prisma.Decimal;
  percentageAbove: Prisma.Decimal | null;
  tierThresholdCents: number | null;
  fixedOrderFeeCents: number;
  fixedOrderThresholdCents: number | null;
  fixedOrderFeeAboveCents: number | null;
  fixedItemFeeCents: number;
  listingFeeCents: number;
  minimumFeeCents: number | null;
  maximumFeeCents: number | null;
  shopDiscountPercent: Prisma.Decimal;
  calculationBasis: string;
  metadata: Prisma.JsonValue;
  feeCategory: {
    id: string;
    externalCategoryId: string | null;
    officialName: string;
  } | null;
  feeSchedule: {
    id: string;
    version: string | null;
    status: FeeCatalogStatus;
    marketplaceCode: string | null;
    sellerProfile: string | null;
  } | null;
}

export function mapFeeRuleProjection(rule: FeeRuleProjection): MarketplaceFeeRule | null {
  const schedule = rule.feeSchedule;
  const category = rule.feeCategory;
  if (!schedule?.marketplaceCode || !schedule.version || !schedule.sellerProfile || !category?.externalCategoryId) return null;
  const calculationBasis = rule.calculationBasis === "ITEM_PRICE" ? "ITEM_PRICE" : "ITEM_PLUS_BUYER_SHIPPING";
  return {
    id: rule.id,
    catalogId: schedule.id,
    catalogVersion: schedule.version,
    catalogStatus: schedule.status,
    marketplaceCode: schedule.marketplaceCode,
    categoryId: category.externalCategoryId,
    officialCategoryName: category.officialName,
    sellerProfile: rule.sellerProfile ?? schedule.sellerProfile,
    shopModel: rule.shopModel,
    condition: rule.itemCondition,
    validFrom: rule.validFrom,
    validUntil: rule.validUntil,
    priority: rule.priority,
    percentageBasisPoints: percentToBasisPoints(rule.percentage),
    percentageAboveBasisPoints: rule.percentageAbove ? percentToBasisPoints(rule.percentageAbove) : null,
    tierThresholdCents: rule.tierThresholdCents,
    fixedOrderFeeCents: rule.fixedOrderFeeCents,
    fixedOrderThresholdCents: rule.fixedOrderThresholdCents,
    fixedOrderFeeAboveCents: rule.fixedOrderFeeAboveCents,
    fixedItemFeeCents: rule.fixedItemFeeCents,
    listingFeeCents: rule.listingFeeCents,
    minimumFeeCents: rule.minimumFeeCents,
    maximumFeeCents: rule.maximumFeeCents,
    shopDiscountBasisPoints: percentToBasisPoints(rule.shopDiscountPercent),
    feeVatRateBasisPoints: metadataNumber(rule.metadata, "feeVatRateBasisPoints") ?? 1900,
    calculationBasis,
  };
}

function percentToBasisPoints(value: Prisma.Decimal) {
  return Math.round(Number(value) * 100);
}

function metadataNumber(value: Prisma.JsonValue, key: string): number | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const candidate = value[key];
  return typeof candidate === "number" && Number.isSafeInteger(candidate) ? candidate : null;
}
