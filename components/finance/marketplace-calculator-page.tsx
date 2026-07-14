import { requireOrg } from "@/lib/org";
import { mapFeeRuleProjection } from "@/lib/services/marketplace-pricing-query-service";
import { PageHeader } from "@/components/app/page-header";
import { MarketplaceCalculator } from "@/components/finance/marketplace-calculator";

export async function MarketplaceCalculatorPage({ marketplaceCode }: { marketplaceCode: "EBAY_DE" | "KAUFLAND_DE" }) {
  const { db, organization } = await requireOrg();
  const [schedule, accounts, products, defaultTaxRate] = await Promise.all([
    db.feeSchedule.findFirst({
      where: { marketplaceCode, status: "ACTIVE" },
      orderBy: { validFrom: "desc" },
      include: {
        categories: { where: { externalCategoryId: { not: null }, active: true }, include: { parent: true }, orderBy: { officialName: "asc" } },
        rules: { where: { active: true }, include: { feeCategory: true, feeSchedule: true } },
      },
    }),
    db.marketplaceAccount.findMany({ where: { marketplaceCode, active: true }, orderBy: { displayName: "asc" } }),
    db.product.findMany({
      orderBy: [{ name: "asc" }, { variant: "asc" }],
      take: 500,
      include: {
        marketplaceMappings: { where: { marketplaceCode }, include: { feeCategory: true } },
      },
    }),
    db.taxRate.findFirst({ where: { isDefault: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  const marketplaceName = marketplaceCode === "EBAY_DE" ? "eBay" : "Kaufland";
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Finanzen / Einkaufsentscheidung"
        title={`${marketplaceName}-Preisrechner`}
        description={`Einkaufspreis und erwarteten Verkaufspreis gegen den aktiven ${marketplaceName}-Gebührenkatalog prüfen.`}
      />
      <MarketplaceCalculator
        marketplaceCode={marketplaceCode}
        catalog={schedule ? {
          id: schedule.id,
          version: schedule.version ?? "–",
          sourceUrl: schedule.sourceUrl,
          retrievedAt: schedule.retrievedAt?.toISOString() ?? null,
        } : null}
        accounts={accounts.map((account) => ({
          id: account.id,
          displayName: account.displayName,
          sellerProfile: account.sellerProfile ?? "",
          shopModel: account.shopModel,
          marketplaceCountry: account.marketplaceCountry,
          taxProfile: account.taxProfile ?? organization.taxProfile,
          standardCondition: account.standardCondition,
          defaultShippingCostCents: account.defaultShippingCostCents,
          defaultPackagingCostCents: account.defaultPackagingCostCents,
          promotedListingsDefault: account.promotedListingsDefault,
          defaultAdvertisingBasisPoints: Math.round(Number(account.defaultAdvertisingPercent) * 100),
        }))}
        categories={(schedule?.categories ?? []).map((category) => ({
          id: category.id,
          externalCategoryId: category.externalCategoryId ?? "",
          officialName: category.officialName,
          groupName: category.parent?.officialName ?? null,
        }))}
        rules={(schedule?.rules ?? []).map(mapFeeRuleProjection).filter((rule) => rule !== null).map((rule) => ({
          ...rule,
          validFrom: rule.validFrom.toISOString(),
          validUntil: rule.validUntil?.toISOString() ?? null,
        }))}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          brand: product.brand,
          variant: product.variant,
          size: product.size,
          ean: product.ean,
          defaultPriceCents: product.defaultPriceCents,
          defaultCondition: product.defaultCondition,
          defaultShippingCostCents: product.defaultShippingCostCents,
          defaultPackagingCostCents: product.defaultPackagingCostCents,
          lastReferenceSalePriceCents: product.lastReferenceSalePriceCents,
          mapping: product.marketplaceMappings[0] ? {
            feeCategoryId: product.marketplaceMappings[0].feeCategoryId,
            externalCategoryId: product.marketplaceMappings[0].feeCategory.externalCategoryId ?? "",
            status: product.marketplaceMappings[0].status,
          } : null,
        }))}
        organizationDefaults={{
          inputTaxDeductible: organization.inputTaxDeductible,
          saleTaxRateBasisPoints: Math.round(Number(defaultTaxRate?.ratePercent ?? 19) * 100),
        }}
      />
    </div>
  );
}
