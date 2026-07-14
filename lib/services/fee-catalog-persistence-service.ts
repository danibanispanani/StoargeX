import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import type { NormalizedFeeCatalog } from "@/lib/services/fee-catalog-service";

type Tx = Prisma.TransactionClient;

export async function persistNormalizedFeeCatalog(input: {
  tx: Tx;
  organizationId: string;
  createdById: string;
  catalog: NormalizedFeeCatalog;
}) {
  const { tx, organizationId, createdById, catalog } = input;
  const existing = await tx.feeSchedule.findFirst({
    where: { organizationId, sourceHash: catalog.sourceHash },
    select: { id: true, status: true },
  });
  if (existing) return { feeScheduleId: existing.id, status: existing.status, imported: false };

  const platform = await tx.platform.upsert({
    where: {
      organizationId_name: {
        organizationId,
        name: catalog.definition.marketplaceName,
      },
    },
    create: {
      organizationId,
      name: catalog.definition.marketplaceName,
      marketplaceCode: catalog.definition.marketplaceCode,
    },
    update: { marketplaceCode: catalog.definition.marketplaceCode },
  });
  const batch = await tx.importBatch.create({
    data: {
      organizationId,
      fileName: `${catalog.definition.marketplaceCode.toLowerCase()}-${catalog.definition.version}.json`,
      fileHash: catalog.sourceHash,
      importType: "fee_catalog",
      status: "RUNNING",
      createdById,
      summary: {},
    },
  });
  const schedule = await tx.feeSchedule.create({
    data: {
      organizationId,
      platformId: platform.id,
      name: `${catalog.definition.marketplaceName} ${catalog.definition.version}`,
      description: `Versionierter Gebührenkatalog für ${catalog.definition.marketplaceName}`,
      marketplaceCode: catalog.definition.marketplaceCode,
      sellerProfile: catalog.definition.sellerProfile,
      version: catalog.definition.version,
      sourceUrl: catalog.definition.sourceUrl,
      retrievedAt: new Date(catalog.definition.retrievedAt),
      validFrom: new Date(catalog.definition.validFrom),
      sourceHash: catalog.sourceHash,
      status: "DRAFT",
      notes: catalog.definition.reviewRequired.join("\n") || null,
      importReport: catalog.importReport,
      active: true,
    },
  });

  const groupIds = new Map<string, string>();
  const groups = catalog.categories
    .map((item) => item.group)
    .filter((group): group is string => Boolean(group));
  for (const group of new Set(groups)) {
    const parent = await tx.feeCategory.create({
      data: {
        organizationId,
        feeScheduleId: schedule.id,
        marketplaceCode: catalog.definition.marketplaceCode,
        officialName: group,
        validFrom: new Date(catalog.definition.validFrom),
        sourceReference: catalog.definition.sourceUrl,
      },
    });
    groupIds.set(group, parent.id);
  }

  const categoryIds = new Map<string, string>();
  for (const [index, category] of catalog.categories.entries()) {
    const record = await tx.feeCategory.create({
      data: {
        organizationId,
        feeScheduleId: schedule.id,
        parentId: category.group ? groupIds.get(category.group) : null,
        marketplaceCode: catalog.definition.marketplaceCode,
        officialName: category.officialName,
        externalCategoryId: category.externalCategoryId,
        validFrom: new Date(catalog.definition.validFrom),
        sourceReference: catalog.definition.sourceUrl,
      },
    });
    categoryIds.set(category.externalCategoryId, record.id);
    await createSourceReference(tx, {
      organizationId,
      batchId: batch.id,
      rowNumber: index + 1,
      rowHash: hash(`${catalog.sourceHash}:category:${category.externalCategoryId}`),
      targetEntity: "FEE_CATEGORY",
      targetEntityId: record.id,
      legacyReference: category.externalCategoryId,
    });
  }

  for (const [index, rule] of catalog.rules.entries()) {
    const feeCategoryId = categoryIds.get(rule.categoryId);
    if (!feeCategoryId) throw new Error(`Katalogregel verweist auf unbekannte Kategorie ${rule.categoryId}.`);
    const record = await tx.feeRule.create({
      data: {
        organizationId,
        feeScheduleId: schedule.id,
        feeCategoryId,
        platformId: platform.id,
        category: rule.officialCategoryName,
        sellerProfile: rule.sellerProfile,
        shopModel: rule.shopModel,
        itemCondition: rule.condition,
        validFrom: rule.validFrom,
        validUntil: rule.validUntil,
        percentage: basisPointsToPercent(rule.percentageBasisPoints),
        percentageAbove: rule.percentageAboveBasisPoints === null ? null : basisPointsToPercent(rule.percentageAboveBasisPoints),
        tierThresholdCents: rule.tierThresholdCents,
        fixedOrderFeeCents: rule.fixedOrderFeeCents,
        fixedOrderThresholdCents: rule.fixedOrderThresholdCents,
        fixedOrderFeeAboveCents: rule.fixedOrderFeeAboveCents,
        fixedItemFeeCents: rule.fixedItemFeeCents,
        listingFeeCents: rule.listingFeeCents,
        shopDiscountPercent: basisPointsToPercent(rule.shopDiscountBasisPoints ?? 0),
        calculationBasis: rule.calculationBasis,
        vatTreatment: "EXCLUDED",
        priority: rule.priority,
        origin: "IMPORTED",
        source: catalog.definition.sourceUrl,
        sourceReference: rule.id,
        metadata: { feeVatRateBasisPoints: rule.feeVatRateBasisPoints },
      },
    });
    await createSourceReference(tx, {
      organizationId,
      batchId: batch.id,
      rowNumber: catalog.categories.length + index + 1,
      rowHash: hash(`${catalog.sourceHash}:rule:${rule.id}`),
      targetEntity: "FEE_RULE",
      targetEntityId: record.id,
      legacyReference: rule.id,
    });
  }

  await createSourceReference(tx, {
    organizationId,
    batchId: batch.id,
    rowNumber: 0,
    rowHash: hash(`${catalog.sourceHash}:schedule`),
    targetEntity: "FEE_SCHEDULE",
    targetEntityId: schedule.id,
    legacyReference: catalog.catalogKey,
  });
  await tx.importBatch.update({
    where: { id: batch.id },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      summary: catalog.importReport,
    },
  });
  return { feeScheduleId: schedule.id, status: schedule.status, imported: true };
}

export async function activateFeeCatalog(input: {
  tx: Tx;
  organizationId: string;
  feeScheduleId: string;
}) {
  const schedule = await input.tx.feeSchedule.findFirst({
    where: { id: input.feeScheduleId, organizationId: input.organizationId },
    select: { id: true, marketplaceCode: true, status: true, importReport: true },
  });
  if (!schedule?.marketplaceCode) throw new Error("Katalog nicht gefunden oder Marktplatz fehlt.");
  if (!isActivationSafe(schedule.importReport)) throw new Error("Der Katalog ist nicht vollständig validiert und kann nicht aktiviert werden.");
  const [newCategories, existingMappings] = await Promise.all([
    input.tx.feeCategory.findMany({
      where: { organizationId: input.organizationId, feeScheduleId: schedule.id, externalCategoryId: { not: null } },
      select: { id: true, externalCategoryId: true },
    }),
    input.tx.productMarketplaceMapping.findMany({
      where: { organizationId: input.organizationId, marketplaceCode: schedule.marketplaceCode },
      include: { feeCategory: { select: { externalCategoryId: true } } },
    }),
  ]);
  const categoryByExternalId = new Map(
    newCategories.flatMap((category) => category.externalCategoryId ? [[category.externalCategoryId, category.id] as const] : [])
  );
  for (const mapping of existingMappings) {
    const nextCategoryId = mapping.feeCategory.externalCategoryId
      ? categoryByExternalId.get(mapping.feeCategory.externalCategoryId)
      : undefined;
    await input.tx.productMarketplaceMapping.update({
      where: { id: mapping.id },
      data: nextCategoryId
        ? { feeCategoryId: nextCategoryId }
        : { status: "REVIEW_REQUIRED", confirmedAt: null, confirmedById: null },
    });
  }
  await input.tx.feeSchedule.updateMany({
    where: {
      organizationId: input.organizationId,
      marketplaceCode: schedule.marketplaceCode,
      status: "ACTIVE",
      id: { not: schedule.id },
    },
    data: { status: "ARCHIVED" },
  });
  await input.tx.feeSchedule.update({ where: { id: schedule.id }, data: { status: "ACTIVE" } });
  await input.tx.marketplaceAccount.updateMany({
    where: {
      organizationId: input.organizationId,
      marketplaceCode: schedule.marketplaceCode,
    },
    data: { defaultFeeScheduleId: schedule.id },
  });
  await input.tx.marketplacePricingCalculation.updateMany({
    where: {
      organizationId: input.organizationId,
      marketplaceCode: schedule.marketplaceCode,
      feeScheduleId: { not: schedule.id },
    },
    data: { stale: true },
  });
  return schedule.marketplaceCode;
}

function isActivationSafe(value: Prisma.JsonValue): boolean {
  return Boolean(value && !Array.isArray(value) && typeof value === "object" && value.activationSafe === true);
}

function basisPointsToPercent(value: number) {
  return (value / 100).toFixed(4);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function createSourceReference(
  tx: Tx,
  input: {
    organizationId: string;
    batchId: string;
    rowNumber: number;
    rowHash: string;
    targetEntity: "FEE_CATEGORY" | "FEE_RULE" | "FEE_SCHEDULE";
    targetEntityId: string;
    legacyReference: string;
  }
) {
  await tx.sourceReference.create({
    data: {
      organizationId: input.organizationId,
      importBatchId: input.batchId,
      sheetName: "Normalized fee catalog",
      rowNumber: input.rowNumber,
      rowHash: input.rowHash,
      targetEntity: input.targetEntity,
      targetEntityId: input.targetEntityId,
      legacyReference: input.legacyReference,
      status: "LINKED",
    },
  });
}
