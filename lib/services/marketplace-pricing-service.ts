export type MarketplaceCode = "EBAY_DE" | "KAUFLAND_DE" | (string & {});
export type MoneyInputMode = "GROSS" | "NET";
export type ListingFeeMode = "AUTO" | "YES" | "NO";
export type MarketplaceItemCondition = "NEW" | "OPEN_BOX" | "REFURBISHED" | "USED" | "DEFECTIVE";

export interface MarketplaceFeeRule {
  id: string;
  catalogId: string;
  catalogVersion: string;
  catalogStatus: "DRAFT" | "REVIEW_REQUIRED" | "ACTIVE" | "ARCHIVED";
  marketplaceCode: MarketplaceCode;
  categoryId: string;
  officialCategoryName: string;
  sellerProfile: string;
  shopModel: string | null;
  condition: MarketplaceItemCondition | null;
  validFrom: Date;
  validUntil: Date | null;
  priority: number;
  percentageBasisPoints: number;
  percentageAboveBasisPoints: number | null;
  tierThresholdCents: number | null;
  fixedOrderFeeCents: number;
  fixedOrderThresholdCents: number | null;
  fixedOrderFeeAboveCents: number | null;
  fixedItemFeeCents: number;
  listingFeeCents: number;
  minimumFeeCents: number | null;
  maximumFeeCents: number | null;
  shopDiscountBasisPoints?: number;
  feeVatRateBasisPoints: number;
  calculationBasis: "ITEM_PRICE" | "ITEM_PLUS_BUYER_SHIPPING";
}

export interface MarketplacePricingInput {
  marketplaceCode: MarketplaceCode;
  marketplaceAccountId: string | null;
  sellerProfile: string;
  shopModel: string | null;
  categoryId: string;
  condition: MarketplaceItemCondition | null;
  calculatedAt: Date;
  purchasePriceCents: number;
  purchasePriceMode: MoneyInputMode;
  purchaseTaxRateBasisPoints: number;
  inputTaxDeductible: boolean;
  salePriceCents: number;
  buyerShippingCents: number;
  ownShippingCents: number;
  packagingCents: number;
  otherDirectCostsCents: number;
  quantity: number;
  saleTaxRateBasisPoints: number;
  listingFeeMode: ListingFeeMode;
  promotedListingBasisPoints: number;
  internationalFeeBasisPoints: number;
  manualPlatformFeeGrossCents?: number;
  rules: readonly MarketplaceFeeRule[];
}

export interface MarketplacePricingResult {
  marketplaceCode: MarketplaceCode;
  catalogId: string;
  catalogVersion: string;
  ruleId: string;
  officialCategoryName: string;
  customerGrossCents: number;
  saleNetCents: number;
  purchaseProfitEffectiveCents: number;
  grossMarginCents: number;
  grossMarginBasisPoints: number | null;
  directCosts: {
    ownShippingCents: number;
    packagingCents: number;
    otherCents: number;
    totalCents: number;
  };
  profitCents: number;
  profitMarginBasisPoints: number | null;
  expectedPayoutCents: number;
  fees: {
    commissionNetCents: number;
    fixedOrderNetCents: number;
    fixedItemNetCents: number;
    listingNetCents: number;
    shopDiscountNetCents: number;
    advertisingNetCents: number;
    internationalNetCents: number;
    manualCorrectionNetCents: number;
    platformNetCents: number;
    vatCents: number;
    platformGrossCents: number;
    profitEffectiveCents: number;
    monthlyAccountCostCents: 0;
  };
  warnings: string[];
}

export class MarketplacePricingError extends Error {
  constructor(
    public readonly code:
      | "MISSING_CATALOG"
      | "MISSING_CATEGORY"
      | "UNSUPPORTED_PROFILE"
      | "INVALID_INPUT"
      | "NO_BREAK_EVEN",
    message: string
  ) {
    super(message);
    this.name = "MarketplacePricingError";
  }
}

export function resolveMarketplaceFeeRule(
  rules: readonly MarketplaceFeeRule[],
  input: Pick<MarketplacePricingInput, "marketplaceCode" | "categoryId" | "sellerProfile" | "shopModel" | "condition" | "calculatedAt">
): MarketplaceFeeRule {
  const activeCatalogRules = rules.filter(
    (rule) =>
      rule.catalogStatus === "ACTIVE" &&
      rule.marketplaceCode === input.marketplaceCode &&
      rule.validFrom <= input.calculatedAt &&
      (!rule.validUntil || input.calculatedAt < rule.validUntil)
  );
  if (activeCatalogRules.length === 0) {
    throw new MarketplacePricingError("MISSING_CATALOG", "Für diesen Marktplatz ist kein aktiver Gebührenkatalog vorhanden.");
  }
  const categoryRules = activeCatalogRules.filter((rule) => rule.categoryId === input.categoryId);
  if (categoryRules.length === 0) {
    throw new MarketplacePricingError("MISSING_CATEGORY", "Für die gewählte Gebührenkategorie ist keine aktive Regel vorhanden.");
  }
  const profileRules = categoryRules.filter((rule) => rule.sellerProfile === input.sellerProfile);
  if (profileRules.length === 0) {
    throw new MarketplacePricingError("UNSUPPORTED_PROFILE", "Das gewählte Verkäuferprofil wird vom aktiven Katalog nicht vollständig unterstützt.");
  }
  const matches = profileRules.filter(
    (rule) =>
      (rule.shopModel === null || rule.shopModel === input.shopModel) &&
      (rule.condition === null || rule.condition === input.condition)
  );
  if (matches.length === 0) {
    throw new MarketplacePricingError("UNSUPPORTED_PROFILE", "Shopmodell oder Artikelzustand werden vom aktiven Katalog nicht unterstützt.");
  }
  return [...matches].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const specificityA = Number(a.shopModel !== null) + Number(a.condition !== null);
    const specificityB = Number(b.shopModel !== null) + Number(b.condition !== null);
    return specificityB - specificityA || b.validFrom.getTime() - a.validFrom.getTime();
  })[0];
}

export function calculateMarketplacePrice(input: MarketplacePricingInput): MarketplacePricingResult {
  validateInput(input);
  const rule = resolveMarketplaceFeeRule(input.rules, input);
  const itemRevenueGrossCents = input.salePriceCents * input.quantity;
  const customerGrossCents = itemRevenueGrossCents + input.buyerShippingCents;
  const feeBasisCents = rule.calculationBasis === "ITEM_PLUS_BUYER_SHIPPING"
    ? customerGrossCents
    : itemRevenueGrossCents;
  const commissionNetCents = clampFee(
    tieredRate(
      feeBasisCents,
      rule.percentageBasisPoints,
      rule.tierThresholdCents,
      rule.percentageAboveBasisPoints
    ),
    rule.minimumFeeCents,
    rule.maximumFeeCents
  );
  const fixedOrderNetCents = rule.fixedOrderThresholdCents !== null && feeBasisCents > rule.fixedOrderThresholdCents
    ? rule.fixedOrderFeeAboveCents ?? rule.fixedOrderFeeCents
    : rule.fixedOrderFeeCents;
  const fixedItemNetCents = rule.fixedItemFeeCents * input.quantity;
  const listingNetCents = input.listingFeeMode === "YES" ? rule.listingFeeCents : 0;
  const advertisingNetCents = input.marketplaceCode === "EBAY_DE"
    ? rateCents(feeBasisCents, input.promotedListingBasisPoints)
    : 0;
  const internationalNetCents = input.marketplaceCode === "EBAY_DE"
    ? rateCents(feeBasisCents, input.internationalFeeBasisPoints)
    : 0;
  const preDiscountPlatformNetCents =
    commissionNetCents +
    fixedOrderNetCents +
    fixedItemNetCents +
    listingNetCents +
    advertisingNetCents +
    internationalNetCents;
  // eBay's documented Platin discount applies to the variable and fixed
  // final-value fee, not to ads, listing fees or international surcharges.
  const shopDiscountNetCents = rateCents(
    commissionNetCents + fixedOrderNetCents,
    rule.shopDiscountBasisPoints ?? 0
  );
  const calculatedPlatformNetCents = preDiscountPlatformNetCents - shopDiscountNetCents;
  const calculatedVatCents = rateCents(calculatedPlatformNetCents, rule.feeVatRateBasisPoints);
  const calculatedGrossCents = calculatedPlatformNetCents + calculatedVatCents;

  const manualGrossCents = input.manualPlatformFeeGrossCents;
  const hasManualOverride = manualGrossCents !== undefined;
  const platformGrossCents = hasManualOverride ? manualGrossCents : calculatedGrossCents;
  const platformNetCents = hasManualOverride
    ? grossToNetBasisPoints(platformGrossCents, rule.feeVatRateBasisPoints)
    : calculatedPlatformNetCents;
  const vatCents = platformGrossCents - platformNetCents;
  const feeProfitEffectiveCents = input.inputTaxDeductible ? platformNetCents : platformGrossCents;
  const purchasePerItemProfitEffectiveCents = input.purchasePriceMode === "NET"
    ? input.purchasePriceCents
    : input.inputTaxDeductible
      ? grossToNetBasisPoints(input.purchasePriceCents, input.purchaseTaxRateBasisPoints)
      : input.purchasePriceCents;
  const purchaseProfitEffectiveCents = purchasePerItemProfitEffectiveCents * input.quantity;
  const saleNetCents = grossToNetBasisPoints(customerGrossCents, input.saleTaxRateBasisPoints);
  const grossMarginCents = saleNetCents - purchaseProfitEffectiveCents;
  const profitCents =
    grossMarginCents -
    feeProfitEffectiveCents -
    input.ownShippingCents -
    input.packagingCents -
    input.otherDirectCostsCents;

  return {
    marketplaceCode: input.marketplaceCode,
    catalogId: rule.catalogId,
    catalogVersion: rule.catalogVersion,
    ruleId: rule.id,
    officialCategoryName: rule.officialCategoryName,
    customerGrossCents,
    saleNetCents,
    purchaseProfitEffectiveCents,
    grossMarginCents,
    grossMarginBasisPoints: ratioBasisPoints(grossMarginCents, saleNetCents),
    directCosts: {
      ownShippingCents: input.ownShippingCents,
      packagingCents: input.packagingCents,
      otherCents: input.otherDirectCostsCents,
      totalCents: input.ownShippingCents + input.packagingCents + input.otherDirectCostsCents,
    },
    profitCents,
    profitMarginBasisPoints: ratioBasisPoints(profitCents, saleNetCents),
    expectedPayoutCents: customerGrossCents - platformGrossCents,
    fees: {
      commissionNetCents: hasManualOverride ? 0 : commissionNetCents,
      fixedOrderNetCents: hasManualOverride ? 0 : fixedOrderNetCents,
      fixedItemNetCents: hasManualOverride ? 0 : fixedItemNetCents,
      listingNetCents: hasManualOverride ? 0 : listingNetCents,
      shopDiscountNetCents: hasManualOverride ? 0 : shopDiscountNetCents,
      advertisingNetCents: hasManualOverride ? 0 : advertisingNetCents,
      internationalNetCents: hasManualOverride ? 0 : internationalNetCents,
      manualCorrectionNetCents: hasManualOverride ? platformNetCents : 0,
      platformNetCents,
      vatCents,
      platformGrossCents,
      profitEffectiveCents: feeProfitEffectiveCents,
      monthlyAccountCostCents: 0,
    },
    warnings: hasManualOverride ? ["MANUAL_FEE_OVERRIDE"] : [],
  };
}

export function findBreakEven(
  input: MarketplacePricingInput,
  options: { maxSalePriceCents?: number; maxIterations?: number } = {}
): MarketplacePricingResult & { salePriceCents: number } {
  const max = options.maxSalePriceCents ?? 100_000_000;
  const maxIterations = options.maxIterations ?? 64;
  let low = 0;
  let high = max;
  const highResult = calculateMarketplacePrice({ ...input, salePriceCents: high });
  if (highResult.profitCents < 0) {
    throw new MarketplacePricingError("NO_BREAK_EVEN", "Innerhalb der definierten Preisobergrenze existiert kein Break-even.");
  }
  let iterations = 0;
  while (low < high && iterations < maxIterations) {
    const mid = Math.floor((low + high) / 2);
    const result = calculateMarketplacePrice({ ...input, salePriceCents: mid });
    if (result.profitCents >= 0) high = mid;
    else low = mid + 1;
    iterations += 1;
  }
  if (low < high) {
    throw new MarketplacePricingError("NO_BREAK_EVEN", "Die Break-even-Suche hat die Abbruchgrenze erreicht.");
  }
  return { ...calculateMarketplacePrice({ ...input, salePriceCents: low }), salePriceCents: low };
}

export function findTargetMarginPrice(
  input: MarketplacePricingInput,
  targetMarginBasisPoints: number,
  options: { maxSalePriceCents?: number; maxIterations?: number } = {}
): MarketplacePricingResult & { salePriceCents: number } {
  if (!Number.isSafeInteger(targetMarginBasisPoints) || targetMarginBasisPoints < 0 || targetMarginBasisPoints >= 10_000) {
    throw new MarketplacePricingError("INVALID_INPUT", "Die Zielmarge muss zwischen 0 und unter 100 Prozent liegen.");
  }
  const max = options.maxSalePriceCents ?? 100_000_000;
  let low = 0;
  let high = max;
  const meetsTarget = (salePriceCents: number) => {
    const result = calculateMarketplacePrice({ ...input, salePriceCents });
    return result.profitMarginBasisPoints !== null && result.profitMarginBasisPoints >= targetMarginBasisPoints;
  };
  if (!meetsTarget(high)) throw new MarketplacePricingError("NO_BREAK_EVEN", "Die Zielmarge ist innerhalb der Preisobergrenze nicht erreichbar.");
  let iterations = 0;
  const maxIterations = options.maxIterations ?? 64;
  while (low < high && iterations < maxIterations) {
    const mid = Math.floor((low + high) / 2);
    if (meetsTarget(mid)) high = mid;
    else low = mid + 1;
    iterations += 1;
  }
  if (low < high) throw new MarketplacePricingError("NO_BREAK_EVEN", "Die Zielmargensuche hat die Abbruchgrenze erreicht.");
  return { ...calculateMarketplacePrice({ ...input, salePriceCents: low }), salePriceCents: low };
}

export function findMaximumPurchasePrice(
  input: MarketplacePricingInput,
  targetProfitCents = 0,
  options: { maxPurchasePriceCents?: number; maxIterations?: number } = {}
): number {
  if (!Number.isSafeInteger(targetProfitCents)) throw new MarketplacePricingError("INVALID_INPUT", "Zielgewinn muss als Centbetrag vorliegen.");
  let low = 0;
  let high = options.maxPurchasePriceCents ?? 100_000_000;
  let iterations = 0;
  const maxIterations = options.maxIterations ?? 64;
  while (low < high && iterations < maxIterations) {
    const mid = Math.ceil((low + high) / 2);
    const result = calculateMarketplacePrice({ ...input, purchasePriceCents: mid });
    if (result.profitCents >= targetProfitCents) low = mid;
    else high = mid - 1;
    iterations += 1;
  }
  return low;
}

function validateInput(input: MarketplacePricingInput) {
  const integerValues = [
    input.purchasePriceCents,
    input.salePriceCents,
    input.buyerShippingCents,
    input.ownShippingCents,
    input.packagingCents,
    input.otherDirectCostsCents,
    input.quantity,
  ];
  if (integerValues.some((value) => !Number.isSafeInteger(value) || value < 0) || input.quantity < 1) {
    throw new MarketplacePricingError("INVALID_INPUT", "Geldbeträge müssen nichtnegative Centbeträge sein; Menge muss mindestens 1 sein.");
  }
  if (!Number.isSafeInteger(input.salePriceCents * input.quantity) || !Number.isSafeInteger(input.purchasePriceCents * input.quantity)) {
    throw new MarketplacePricingError("INVALID_INPUT", "Preis mal Menge überschreitet den sicher berechenbaren Bereich.");
  }
  const rateValues = [input.purchaseTaxRateBasisPoints, input.saleTaxRateBasisPoints, input.promotedListingBasisPoints, input.internationalFeeBasisPoints];
  if (rateValues.some((value) => !Number.isSafeInteger(value) || value < 0 || value > 10_000)) {
    throw new MarketplacePricingError("INVALID_INPUT", "Steuer- und Gebührensätze müssen zwischen 0 und 100 Prozent liegen.");
  }
  if (input.manualPlatformFeeGrossCents !== undefined && (!Number.isSafeInteger(input.manualPlatformFeeGrossCents) || input.manualPlatformFeeGrossCents < 0)) {
    throw new MarketplacePricingError("INVALID_INPUT", "Der manuelle Gebührenwert muss ein nichtnegativer Centbetrag sein.");
  }
}

function tieredRate(cents: number, firstBasisPoints: number, threshold: number | null, aboveBasisPoints: number | null) {
  if (threshold === null || aboveBasisPoints === null || cents <= threshold) return rateCents(cents, firstBasisPoints);
  return rateCents(threshold, firstBasisPoints) + rateCents(cents - threshold, aboveBasisPoints);
}

function rateCents(cents: number, basisPoints: number) {
  if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new MarketplacePricingError("INVALID_INPUT", "Gebührensätze müssen als nichtnegative Basispunkte vorliegen.");
  }
  return Number((BigInt(cents) * BigInt(basisPoints) + BigInt(5_000)) / BigInt(10_000));
}

function grossToNetBasisPoints(grossCents: number, taxBasisPoints: number) {
  if (taxBasisPoints === 0) return grossCents;
  const denominator = 10_000 + taxBasisPoints;
  return Number((BigInt(grossCents) * BigInt(10_000) + BigInt(Math.floor(denominator / 2))) / BigInt(denominator));
}

function ratioBasisPoints(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  const sign = numerator < 0 ? -1 : 1;
  return sign * Number((BigInt(Math.abs(numerator)) * BigInt(10_000) + BigInt(Math.floor(denominator / 2))) / BigInt(denominator));
}

function clampFee(value: number, minimum: number | null, maximum: number | null) {
  const aboveMinimum = minimum === null ? value : Math.max(value, minimum);
  return maximum === null ? aboveMinimum : Math.min(aboveMinimum, maximum);
}
