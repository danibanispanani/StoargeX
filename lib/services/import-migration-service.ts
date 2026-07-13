import { createHash } from "crypto";
import type {
  ImportRowStatus,
  ImportTargetEntity,
  Prisma,
  ReturnStatus,
  SaleStatus,
} from "@prisma/client";
import type { TableKey } from "@/lib/import-export";
import {
  calcReturnLoss,
  calcSale,
  euroToCents,
  grossToNetCents,
  resolveTaxRatePercent,
} from "@/lib/calculations";
import {
  centsToDecimalString,
  createOwnedPurchase,
} from "@/lib/services/owned-purchase-service";
import { createConsignmentStock } from "@/lib/services/consignment-service";
import { reserveDocumentNumber } from "@/lib/services/document-number-service";
import { sell } from "@/lib/services/inventory-service";
import { createManualDebt } from "@/lib/services/debt-service";

export type ImportRow = Record<string, string>;

export interface ImportMetadata {
  fileName?: string;
  fileHash?: string;
  sheetName?: string;
}

export interface ImportReviewItem {
  row: number;
  status: ImportRowStatus;
  message: string;
  legacyReference?: string;
  targetEntity?: ImportTargetEntity;
  warnings?: string[];
  errors?: string[];
}

export interface ImportSummary {
  unchanged: number;
  updateAvailable: number;
  newRows: number;
  conflicts: number;
  linked: number;
  partiallyLinked: number;
  unresolved: number;
  reviewRequired: number;
  errors: number;
  targetCounts: Record<string, number>;
  review: ImportReviewItem[];
}

export interface MigrationImportResult {
  validCount: number;
  errors: Array<{ row: number; message: string }>;
  importedCount?: number;
  batchId?: string;
  summary: ImportSummary;
}

type Tx = Prisma.TransactionClient;

const EMPTY_SUMMARY: ImportSummary = {
  unchanged: 0,
  updateAvailable: 0,
  newRows: 0,
  conflicts: 0,
  linked: 0,
  partiallyLinked: 0,
  unresolved: 0,
  reviewRequired: 0,
  errors: 0,
  targetCounts: {},
  review: [],
};

export async function runMigrationImport(input: {
  tx: Tx;
  organizationId: string;
  createdById: string;
  table: TableKey;
  rows: ImportRow[];
  dryRun: boolean;
  metadata?: ImportMetadata;
  allowConsignment: boolean;
}): Promise<MigrationImportResult> {
  const summary = cloneSummary();
  const errors: Array<{ row: number; message: string }> = [];
  const metadata = normalizeMetadata(input.table, input.rows, input.metadata);

  if (input.table === "produkte" && !input.dryRun) {
    await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:product-import:${input.organizationId}`}))`;
  }

  const existingHashes = await loadExistingRowHashes(input.tx, input.organizationId, input.rows);
  const context = await loadImportContext(
    input.tx,
    input.organizationId,
    input.table,
    input.rows
  );
  if (input.table === "verkauf" && !input.allowConsignment) {
    context.inventoryByLegacy = new Map(
      [...context.inventoryByLegacy].filter(
        ([, position]) => position.inventoryType !== "CONSIGNMENT"
      )
    );
  }
  const plannedRows = planRows(input.table, input.rows, existingHashes, context, errors, summary);
  const validRows = plannedRows.filter(isImportableRow);

  if (input.dryRun) {
    return {
      validCount: validRows.length,
      errors: errors.slice(0, 50),
      summary,
    };
  }

  if (hasBlockingRows(plannedRows)) {
    return {
      validCount: validRows.length,
      errors: errors.slice(0, 50),
      importedCount: 0,
      summary,
    };
  }

  const batch = await input.tx.importBatch.create({
    data: {
      organizationId: input.organizationId,
      fileName: metadata.fileName,
      fileHash: metadata.fileHash,
      importType: input.table,
      status: "RUNNING",
      createdById: input.createdById,
      summary: summary as unknown as Prisma.InputJsonValue,
    },
  });

  let importedCount = 0;
  switch (input.table) {
    case "produkte":
      importedCount = await commitProductImport(input, batch.id, validRows);
      break;
    case "lager":
      importedCount = await commitStockImport(input, batch.id, validRows);
      break;
    case "verkauf":
      importedCount = await commitSalesImport(input, batch.id, validRows, context);
      break;
    case "konsignation":
      importedCount = await commitConsignmentImport(input, batch.id, validRows);
      break;
    case "retouren":
      importedCount = await commitReturnsImport(input, batch.id, validRows, context);
      break;
    case "schulden":
      importedCount = await commitDebtImport(input, batch.id, validRows);
      break;
    case "aufgaben":
      importedCount = await commitTaskImport(input, batch.id, validRows);
      break;
  }

  await input.tx.importBatch.update({
    where: { id: batch.id },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      summary: summary as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    validCount: validRows.length,
    errors: errors.slice(0, 50),
    importedCount,
    batchId: batch.id,
    summary,
  };
}

export function parseLegacyReferences(input?: string | null): string[] {
  if (!input?.trim()) return [];
  const value = input.trim();
  if (value === "-") return [];

  const normalized = value
    .replace(/\r?\n/g, "&")
    .replace(/\s+und\s+/gi, "&")
    .replace(/\s*&\s*/g, "&")
    .replace(/\s+bis\s+/gi, "-")
    .replace(/\s+/g, " ");

  const references: string[] = [];
  for (const token of normalized.split("&").map((part) => part.trim()).filter(Boolean)) {
    const range = token.match(/^([A-ZÄÖÜ]+-\d{2}-)(\d+)\s*-\s*(?:[A-ZÄÖÜ]+-\d{2}-)?(\d+)$/i);
    if (range) {
      const prefix = range[1].toUpperCase();
      const start = Number(range[2]);
      const end = Number(range[3]);
      const width = Math.max(range[2].length, range[3].length);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let current = min; current <= max; current++) {
        references.push(`${prefix}${String(current).padStart(width, "0")}`);
      }
      continue;
    }
    references.push(token.toUpperCase());
  }

  return [...new Set(references)];
}

export function detectHeaderRow(rows: string[][], aliases: string[]): number {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  let bestIndex = 0;
  let bestScore = -1;
  rows.forEach((row, index) => {
    const score = row.filter((cell) => normalizedAliases.has(normalizeHeader(cell))).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function stockGroupingKey(row: ImportRow): string {
  return [
    normalize(row.model),
    normalize(row.colorway),
    normalize(row.size),
    normalize(row.ean),
    normalize(row.haendler),
    normalizeDateKey(parseDateFlexible(row.datum)),
    parseEuroTolerant(row.brutto) ?? "invalid",
    parseEuroTolerant(row.netto) ?? "",
    parseBoolTolerant(row.vst) ? "vst" : "no-vst",
    normalize(row.zm || "Firma"),
    normalize(row.kauf),
    normalize(row.retoure),
    normalize(row.status),
  ].join("|");
}

function planRows(
  table: TableKey,
  rows: ImportRow[],
  existingHashes: Set<string>,
  context: ImportContext,
  errors: Array<{ row: number; message: string }>,
  summary: ImportSummary
): PlannedRow[] {
  const plannedProductKeys = new Set<string>();
  const plannedRows: PlannedRow[] = rows.map((row, index) => {
    const rowNumber = index + 1;
    const rowHash = hashRow(row);
    const legacyReference = primaryLegacyReference(table, row, rowNumber);
    if (existingHashes.has(rowHash)) {
      addReview(summary, {
        row: rowNumber,
        status: "UNCHANGED",
        message: "Zeile wurde bereits importiert.",
        legacyReference,
      });
      return { row, rowNumber, rowHash, legacyReference, status: "UNCHANGED" };
    }

    const validation = validateRow(table, row, rowNumber, context);
    if (validation.errors.length > 0) {
      validation.errors.forEach((message) => errors.push({ row: rowNumber, message }));
      addReview(summary, {
        row: rowNumber,
        status: "ERROR",
        message: validation.errors[0],
        legacyReference,
        errors: validation.errors,
      });
      return { row, rowNumber, rowHash, legacyReference, status: "ERROR" };
    }

    if (table === "produkte") {
      const key = productImportKey(row.name, row.variant);
      if (plannedProductKeys.has(key)) {
        addReview(summary, {
          row: rowNumber,
          status: "CONFLICT",
          message: "Produktname und Variante kommen in dieser Datei mehrfach vor.",
          legacyReference,
          targetEntity: "PRODUCT",
        });
        return { row, rowNumber, rowHash, legacyReference, status: "CONFLICT" };
      }
      plannedProductKeys.add(key);
    }

    addReview(summary, {
      row: rowNumber,
      status: validation.status,
      message: validation.message,
      legacyReference,
      warnings: validation.warnings,
      targetEntity: validation.targetEntity,
    });
    return {
      row,
      rowNumber,
      rowHash,
      legacyReference,
      status: validation.status,
      warnings: validation.warnings,
    };
  });

  if (table === "verkauf") {
    markSaleStockReviewRows(plannedRows, context, summary);
  }

  return plannedRows;
}

async function commitStockImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[]
): Promise<number> {
  const groups = new Map<string, PlannedRow[]>();
  plannedRows.forEach((planned) => {
    const key = stockGroupingKey(planned.row);
    groups.set(key, [...(groups.get(key) ?? []), planned]);
  });

  let imported = 0;
  for (const group of groups.values()) {
    const first = group[0].row;
    const grossCents = requiredCents(first.brutto);
    const created = await createOwnedPurchase({
      organizationId: input.organizationId,
      createdById: input.createdById,
      purchaseDate: parseDateFlexible(first.datum) ?? new Date(),
      vendor: first.haendler?.trim() || "Unbekannt",
      paymentMethod: first.zm?.trim() || "Firma",
      comment: importComment(group),
      lines: [{
        productName: first.model.trim(),
        variant: optionalUndefined(first.colorway),
        size: optionalUndefined(first.size),
        ean: optionalUndefined(first.ean),
        category: optionalUndefined(first.kategorie),
        quantity: group.length,
        unitPriceGrossCents: grossCents,
        inputTaxDeductible: parseBoolTolerant(first.vst),
        inputTaxRatePercent: 19,
        purchaseEntryStatus: pickEntry(first.kauf, "O"),
        returnEntryStatus: pickEntry(first.retoure, "NN"),
        comment: importComment(group),
      }],
      tx: input.tx,
    });
    const target = created.lines[0].inventoryPosition;

    for (const planned of group) {
      await createSourceReference(input.tx, {
        organizationId: input.organizationId,
        batchId,
        sheetName: input.metadata?.sheetName,
        planned,
        targetEntity: "INVENTORY_POSITION",
        targetEntityId: target.id,
        status: "LINKED",
      });
      imported++;
    }
  }
  return imported;
}

async function commitProductImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[]
): Promise<number> {
  let imported = 0;
  for (let offset = 0; offset < plannedRows.length; offset += 500) {
    const chunk = plannedRows.slice(offset, offset + 500);
    const products = await input.tx.product.createManyAndReturn({
      data: chunk.map(({ row }) => ({
        organizationId: input.organizationId,
        name: row.name.trim(),
        variant: optional(row.variant),
        brand: optional(row.brand),
        category: optional(row.category),
        ean: optional(row.ean),
        size: optional(row.size),
        defaultPriceCents: parseEuroTolerant(row.standard_ek),
        imageUrls: parseImageUrls(row.bilder),
      })),
      select: { id: true, name: true, variant: true },
    });
    const productIds = new Map(
      products.map((product) => [productImportKey(product.name, product.variant ?? undefined), product.id])
    );
    await input.tx.sourceReference.createMany({
      data: chunk.map((planned) => {
        const targetEntityId = productIds.get(
          productImportKey(planned.row.name, planned.row.variant)
        );
        if (!targetEntityId) throw new Error("Importiertes Produkt konnte nicht zugeordnet werden.");
        return sourceReferenceData({
          organizationId: input.organizationId,
          batchId,
          sheetName: input.metadata?.sheetName,
          planned,
          targetEntity: "PRODUCT",
          targetEntityId,
          status: "NEW",
        });
      }),
    });
    imported += chunk.length;
  }
  return imported;
}

async function commitConsignmentImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[]
): Promise<number> {
  let imported = 0;
  for (const planned of plannedRows) {
    const row = planned.row;
    const {
      quantityReceived,
      quantityAvailable,
      quantitySold,
      quantityInspection,
      quantityDefective,
    } = deriveConsignmentImportQuantities(row);
    const created = await createConsignmentStock({
      organizationId: input.organizationId,
      createdById: input.createdById,
      partnerCompany: row.partner?.trim() || row.default_partner?.trim() || "Unbekannt",
      externalSku: optionalUndefined(row.bezeichnung || row.sku || row.nr),
      productName: row.name?.trim() || row.artikel?.trim() || row.bezeichnung?.trim() || "Konsignationsartikel",
      brand: optionalUndefined(row.marke || row.brand),
      variant: optionalUndefined(row.bezeichnung || row.colorway),
      ean: optionalUndefined(row.ean),
      identificationNumber: optionalUndefined(row.identifikationsnr || row.identifikationsnummer),
      category: optionalUndefined(row.kategorie),
      quantityReceived,
      quantityAvailable,
      quantitySold,
      quantityInspection,
      quantityDefective,
      costGrossCents: parseEuroTolerant(row.ek_brutto),
      costNetCents: parseEuroTolerant(row.ek_netto),
      settlementAmountCents: parseEuroTolerant(row.endbetrag),
      shippingCostCents: parseEuroTolerant(row.versand),
      realRrpGrossCents: parseEuroTolerant(row.reale_ovp),
      comment: consignmentImportComment(row),
      tx: input.tx,
    });
    await createSourceReference(input.tx, {
      organizationId: input.organizationId,
      batchId,
      sheetName: input.metadata?.sheetName,
      planned,
      targetEntity: "CONSIGNMENT_LOT",
      targetEntityId: created.consignmentLot.id,
      status: "LINKED",
    });
    imported++;
  }
  return imported;
}

async function commitSalesImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[],
  context: ImportContext
): Promise<number> {
  let imported = 0;
  const taxRates = await input.tx.taxRate.findMany({
    select: { country: true, ratePercent: true, isDefault: true },
  });
  const taxRateInput = taxRates.map((rate) => ({
    ...rate,
    ratePercent: Number(rate.ratePercent),
  }));

  for (const planned of plannedRows) {
    const row = planned.row;
    const references = saleStockReferences(row);
    const mappedPositions = references
      .map((reference) => context.inventoryByLegacy.get(reference))
      .filter((position): position is ImportInventoryMapping => Boolean(position));
    const relationStatus = relationStatusFor(references.length, mappedPositions.length);
    const grossCents = requiredCents(row.vk_brutto);
    const soldAt = parseDateFlexible(row.datum || row.verkaufsdatum) ?? new Date();
    const buyerCountry = (row.land?.trim().toUpperCase() || "DE").slice(0, 2);
    const taxRatePercent = row.steuern ? Number(row.steuern.replace(",", ".")) || resolveTaxRatePercent(taxRateInput, buyerCountry) : resolveTaxRatePercent(taxRateInput, buyerCountry);
    const purchaseNetCents =
      parseEuroTolerant(row.ek_netto) ??
      mappedPositions.reduce((sum, position) => sum + position.unitCostNetCents, 0);
    const feeNet = parseEuroTolerant(row.gebuehren_netto) ?? parseEuroTolerant(row.gebuehren_brutto) ?? 0;
    const shipping = parseEuroTolerant(row.versand_netto || row.versand) ?? 0;
    const calc = calcSale({
      saleGrossCents: grossCents,
      taxRatePercent,
      purchaseNetCents,
      shippingCostCents: shipping,
      platformFeeCents: feeNet,
      paymentFeeCents: 0,
    });
    const platform = await resolvePlatform(input.tx, input.organizationId, row.plattform || "Sonstiges");
    const saleNumber = (await reserveDocumentNumber(input.organizationId, "SALE", { tx: input.tx, reference: soldAt })).display;
    const sale = await input.tx.sale.create({
      data: {
        organizationId: input.organizationId,
        platformId: platform.id,
        soldAt,
        quantity: Number(row.menge) || Math.max(1, mappedPositions.length),
        salePriceCents: grossCents,
        saleNetCents: parseEuroTolerant(row.vk_netto) ?? calc.saleNetCents,
        taxRatePercent,
        marginCents: parseEuroTolerant(row.gmarge) ?? calc.marginCents,
        profitCents: parseEuroTolerant(row.gewinn) ?? calc.profitCents,
        buyerCountry,
        shippingMethod: optional(row.portoart || row.versandart),
        shippingCostCents: shipping,
        platformFeeCents: parseEuroTolerant(row.gebuehren_brutto) ?? feeNet,
        platformFeeNetCents: feeNet,
        payoutRecipient: optional(row.auszahlung),
        status: saleStatus(row.gesamtstatus || row.status),
        invoiceCreated: invoiceDone(row.rechnung),
        orderNumber: saleNumber,
        historicalRelationStatus: relationStatus,
        notes: legacyNote(row.orderid, row.kommentar),
      },
    });

    const product = await resolveProduct(input.tx, input.organizationId, row.model || "Historischer Verkauf", row.colorway, row.size, row.ean);
    const saleLine = await input.tx.saleLine.create({
      data: {
        organizationId: input.organizationId,
        saleId: sale.id,
        productId: product.id,
        descriptionSnapshot: row.model?.trim() || "Historischer Verkauf",
        variantSnapshot: optional(row.colorway),
        sizeSnapshot: optional(row.size),
        quantity: sale.quantity,
        unitGrossPrice: centsToDecimalString(Math.round(grossCents / Math.max(1, sale.quantity))),
        grossAmount: centsToDecimalString(grossCents),
        netAmount: centsToDecimalString(grossToNetCents(grossCents, taxRatePercent)),
        comment: legacyNote(row.orderid, row.kommentar),
      },
    });

    for (const position of mappedPositions) {
      const allocation = await input.tx.saleLineAllocation.create({
        data: {
          organizationId: input.organizationId,
          saleLineId: saleLine.id,
          inventoryPositionId: position.inventoryPositionId,
          quantity: 1,
          unitCostNetSnapshot: centsToDecimalString(position.unitCostNetCents),
          inventoryTypeSnapshot: position.inventoryType,
        },
      });
      await sell({
        organizationId: input.organizationId,
        inventoryPositionId: position.inventoryPositionId,
        quantity: 1,
        referenceType: "SaleLineAllocation",
        referenceId: allocation.id,
        referenceAction: "historical_sale_import",
        idempotencyKey: `import:sale:${sale.id}:allocation:${allocation.id}`,
        comment: `Import Verkauf ${saleNumber}`,
        createdById: input.createdById,
        requiredInventoryType: position.inventoryType,
        tx: input.tx,
      });
    }

    await createSourceReference(input.tx, {
      organizationId: input.organizationId,
      batchId,
      sheetName: input.metadata?.sheetName,
      planned,
      targetEntity: "SALE",
      targetEntityId: sale.id,
      status: relationStatus,
    });
    imported++;
  }
  return imported;
}

async function commitReturnsImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[],
  context: ImportContext
): Promise<number> {
  let imported = 0;
  for (const planned of plannedRows) {
    const row = planned.row;
    const saleMapping = context.saleByLegacy.get(normalizeLegacy(row.orderid));
    if (!saleMapping) continue;
    const sale = await input.tx.sale.findFirst({
      where: { id: saleMapping.saleId, organizationId: input.organizationId },
    });
    if (!sale) continue;

    const requestedAt = parseDateFlexible(row.datum || row.meldedatum) ?? new Date();
    const returnNumber = (await reserveDocumentNumber(input.organizationId, "RETURN", { tx: input.tx, reference: requestedAt })).display;
    const refund = parseEuroTolerant(row.erstattung || row.erstattungsbetrag) ?? 0;
    const extra = parseEuroTolerant(row.zusatzkosten) ?? 0;
    const loss = parseEuroTolerant(row.verlust) ?? calcReturnLoss({
      refundGrossCents: refund,
      taxRatePercent: Number(sale.taxRatePercent),
      saleGrossCents: sale.salePriceCents,
      platformFeeCents: sale.platformFeeNetCents,
      paymentFeeCents: 0,
      shippingCostCents: sale.shippingCostCents,
      extraCostCents: extra,
    });
    const ret = await input.tx.return.create({
      data: {
        organizationId: input.organizationId,
        returnNumber,
        saleId: sale.id,
        requestedAt,
        reason: optional(row.ursache || row.grund || row.problem),
        refundAmountCents: refund,
        returnShippingCents: extra,
        lossCents: loss,
        status: returnStatus(row.status || row.status_ware),
        notes: legacyNote(row.orderid, row.kommentar),
      },
    });
    await createSourceReference(input.tx, {
      organizationId: input.organizationId,
      batchId,
      sheetName: input.metadata?.sheetName,
      planned,
      targetEntity: "RETURN",
      targetEntityId: ret.id,
      status: "PARTIALLY_LINKED",
    });
    imported++;
  }
  return imported;
}

async function commitDebtImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[]
): Promise<number> {
  let imported = 0;
  for (const planned of plannedRows) {
    const row = planned.row;
    const amount = requiredCents(row.betrag);
    const status = normalize(row.status) === "beglichen" ? "SETTLED" : normalize(row.status) === "sonstiges" ? "OTHER" : "OPEN";
    const debt = await createManualDebt({
      organizationId: input.organizationId,
      createdById: input.createdById,
      tx: input.tx,
      payload: {
        date: parseDateFlexible(row.datum) ?? new Date(),
        legacyRefId: optional(row.refid),
        description: row.beschreibung?.trim() || "Importierte Schuld",
        type: "MANUAL",
        kind: normalize(row.art) === "kauf" ? "KAUF" : normalize(row.art) === "verkauf" ? "VERKAUF" : "SONSTIGES",
        quantity: Number(row.menge) || 1,
        amountCents: amount,
        debtorName: row.schuldner.trim(),
        creditorName: row.empfaenger.trim(),
        status,
        entryStatus: normalize(row.eintrag) === "fehlt" ? "FEHLT" : "IO",
        settledAt: status === "SETTLED" ? parseDateFlexible(row.beglichen) ?? new Date() : null,
        notes: optional(row.kommentar),
      },
    });
    const refs = parseLegacyReferences(row.refid);
    const positions = await input.tx.sourceReference.findMany({
      where: {
        organizationId: input.organizationId,
        legacyReference: { in: refs },
        targetEntity: "INVENTORY_POSITION",
      },
      select: { targetEntityId: true },
    });
    await input.tx.debtInventoryLink.createMany({
      data: [...new Set(positions.map((position) => position.targetEntityId))].map((inventoryPositionId) => ({
        organizationId: input.organizationId,
        debtId: debt.id,
        inventoryPositionId,
      })),
      skipDuplicates: true,
    });
    await createSourceReference(input.tx, {
      organizationId: input.organizationId,
      batchId,
      sheetName: input.metadata?.sheetName,
      planned,
      targetEntity: "DEBT",
      targetEntityId: debt.id,
      status: refs.length === 0 ? "NEW" : positions.length > 0 ? "LINKED" : "UNRESOLVED",
    });
    imported++;
  }
  return imported;
}

async function commitTaskImport(input: ImportRunInput, batchId: string, plannedRows: PlannedRow[]): Promise<number> {
  let imported = 0;
  for (const planned of plannedRows) {
    const task = await input.tx.task.create({
      data: {
        organizationId: input.organizationId,
        title: planned.row.aufgabe?.trim() || "Importierte Aufgabe",
        description: optional(planned.row.anmerkung),
        area: optional(planned.row.bereich),
        priority: "MEDIUM",
        status: "OPEN",
        createdById: input.createdById,
      },
    });
    await createSourceReference(input.tx, {
      organizationId: input.organizationId,
      batchId,
      sheetName: input.metadata?.sheetName,
      planned,
      targetEntity: "TASK",
      targetEntityId: task.id,
      status: "NEW",
    });
    imported++;
  }
  return imported;
}

interface ImportRunInput {
  tx: Tx;
  organizationId: string;
  createdById: string;
  table: TableKey;
  rows: ImportRow[];
  dryRun: boolean;
  metadata?: ImportMetadata;
}

interface PlannedRow {
  row: ImportRow;
  rowNumber: number;
  rowHash: string;
  legacyReference: string;
  status: ImportRowStatus;
  warnings?: string[];
}

interface ImportContext {
  inventoryByLegacy: Map<string, ImportInventoryMapping>;
  saleByLegacy: Map<string, { saleId: string }>;
  productKeys: Set<string>;
}

interface ImportInventoryMapping {
  inventoryPositionId: string;
  inventoryNumber: string;
  inventoryType: "OWNED" | "CONSIGNMENT";
  quantityAvailable: number;
  unitCostNetCents: number;
}

function isImportableRow(row: PlannedRow): boolean {
  if (
    row.status === "ERROR" ||
    row.status === "UNCHANGED" ||
    row.status === "REVIEW_REQUIRED" ||
    row.status === "CONFLICT"
  ) return false;
  return true;
}

function hasBlockingRows(rows: PlannedRow[]): boolean {
  return rows.some(
    (row) => row.status === "REVIEW_REQUIRED" || row.status === "CONFLICT"
  );
}

function markSaleStockReviewRows(
  plannedRows: PlannedRow[],
  context: ImportContext,
  summary: ImportSummary
): void {
  const usedByPosition = new Map<string, number>();

  for (const planned of plannedRows) {
    if (planned.status === "ERROR" || planned.status === "UNCHANGED") continue;

    const references = saleStockReferences(planned.row);
    const mappedPositions = references
      .map((reference) => context.inventoryByLegacy.get(reference))
      .filter((position): position is ImportInventoryMapping => Boolean(position));

    const conflicts = mappedPositions
      .map((position) => {
        const used = usedByPosition.get(position.inventoryPositionId) ?? 0;
        const nextUsed = used + 1;
        if (nextUsed <= position.quantityAvailable) return null;
        return `${position.inventoryNumber} hat ${position.quantityAvailable} verfügbar, würde aber ${nextUsed}× verwendet.`;
      })
      .filter((message): message is string => Boolean(message));

    if (conflicts.length > 0) {
      const message = `Review nötig: ${conflicts.join(" ")}`;
      planned.status = "REVIEW_REQUIRED";
      planned.warnings = [...(planned.warnings ?? []), message];
      updateReview(summary, planned.rowNumber, {
        status: "REVIEW_REQUIRED",
        message,
        warnings: planned.warnings,
      });
      continue;
    }

    for (const position of mappedPositions) {
      usedByPosition.set(
        position.inventoryPositionId,
        (usedByPosition.get(position.inventoryPositionId) ?? 0) + 1
      );
    }
  }
}

function validateRow(
  table: TableKey,
  row: ImportRow,
  rowNumber: number,
  context: ImportContext
): {
  status: ImportRowStatus;
  message: string;
  warnings: string[];
  errors: string[];
  targetEntity: ImportTargetEntity;
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const needMoney = (field: string, label: string) => {
    if (parseEuroTolerant(row[field]) === null) errors.push(`${label} ist ungültig.`);
  };
  if (table === "produkte") {
    if (!row.name?.trim()) errors.push("Name fehlt.");
    if (row.name?.trim().length > 300) errors.push("Name darf maximal 300 Zeichen lang sein.");
    if (row.variant?.trim().length > 200) errors.push("Variante darf maximal 200 Zeichen lang sein.");
    if (row.category?.trim().length > 100) errors.push("Kategorie darf maximal 100 Zeichen lang sein.");
    if (row.ean?.trim() && !/^\d{1,20}$/.test(row.ean.trim())) {
      errors.push("EAN darf nur aus maximal 20 Ziffern bestehen.");
    }
    if (row.standard_ek?.trim() && parseEuroTolerant(row.standard_ek) === null) {
      errors.push("Standard-EK ist ungültig.");
    }
    if (splitImageUrls(row.bilder).some((value) => !isValidHttpsUrl(value))) {
      errors.push("Bilder müssen gültige öffentliche HTTPS-URLs sein.");
    }
    const exists = context.productKeys.has(productImportKey(row.name, row.variant));
    return {
      status: errors.length ? "ERROR" : exists ? "CONFLICT" : "NEW",
      message: exists
        ? "Produkt mit gleichem Namen und gleicher Variante existiert bereits."
        : "Neues Katalogprodukt wird importiert.",
      warnings,
      errors,
      targetEntity: "PRODUCT",
    };
  }
  if (table === "lager") {
    if (!row.model?.trim()) errors.push("Model fehlt.");
    needMoney("brutto", "Brutto");
    return { status: "NEW", message: "Neue Lagerzeile wird importiert.", warnings, errors, targetEntity: "INVENTORY_POSITION" };
  }
  if (table === "verkauf") {
    needMoney("vk_brutto", "VK brutto");
    const refs = saleStockReferences(row);
    const linked = refs.filter((ref) => context.inventoryByLegacy.has(ref)).length;
    const status = relationStatusFor(refs.length, linked);
    if (status === "UNRESOLVED") warnings.push("Kein eindeutiger Bestandsbezug; Verkauf wird historisch ohne Allocation importiert.");
    return { status, message: `${linked}/${refs.length} Bestandsreferenzen verknüpft.`, warnings, errors, targetEntity: "SALE" };
  }
  if (table === "retouren") {
    if (!context.saleByLegacy.has(normalizeLegacy(row.orderid))) {
      errors.push(`Kein importierter Verkauf zu OrderID "${row.orderid ?? ""}" gefunden.`);
    }
    return { status: errors.length ? "ERROR" : "PARTIALLY_LINKED", message: "Retoure wird mit Verkauf verknüpft.", warnings, errors, targetEntity: "RETURN" };
  }
  if (table === "schulden") {
    needMoney("betrag", "Betrag");
    const refs = parseLegacyReferences(row.refid);
    if (refs.length > 1) warnings.push("Mehrfachreferenz erkannt; Gesamtbetrag wird nicht vervielfacht.");
    return { status: refs.length ? "REVIEW_REQUIRED" : "NEW", message: refs.length ? `${refs.length} Legacy-Bezüge erkannt.` : "Manuelle Schuld ohne Relation.", warnings, errors, targetEntity: "DEBT" };
  }
  if (table === "konsignation") {
    if (!row.artikel?.trim() && !row.name?.trim() && !row.bezeichnung?.trim()) errors.push("Artikel fehlt.");
    const quantities = deriveConsignmentImportQuantities(row);
    if (quantities.quantityReceived < 1) {
      errors.push("Keine importierbare Konsignationsmenge gefunden.");
    }
    warnings.push(...consignmentHistoricalCsvInfo(row));
    return { status: "NEW", message: "Neue K-Position wird importiert.", warnings, errors, targetEntity: "CONSIGNMENT_LOT" };
  }
  if (table === "aufgaben" && !row.aufgabe?.trim()) errors.push("Aufgabe fehlt.");
  return { status: errors.length ? "ERROR" : "NEW", message: `Zeile ${rowNumber} wird importiert.`, warnings, errors, targetEntity: table === "aufgaben" ? "TASK" : "LEGACY_ONLY" };
}

function saleStockReferences(row: ImportRow): string[] {
  if (row.import_resolution === "historical") return [];
  return parseLegacyReferences(row.resolved_lagerids || row.lagerids || row.lagerid);
}

function deriveConsignmentImportQuantities(row: ImportRow) {
  const quantitySold = parseIntSafe(row.verkauft) ?? 0;
  const quantityInspection = parseIntSafe(row.retoure) ?? parseIntSafe(row.retourniert) ?? 0;
  const quantityDefective = parseIntSafe(row.defekt) ?? 0;
  const quantityAvailable =
    parseIntSafe(row.restlager) ??
    parseIntSafe(row.bestand) ??
    parseIntSafe(row.lager) ??
    0;

  return {
    quantityReceived: quantityAvailable + quantitySold + quantityInspection + quantityDefective,
    quantityAvailable,
    quantitySold,
    quantityInspection,
    quantityDefective,
  };
}

function consignmentImportComment(row: ImportRow): string | undefined {
  const details = [
    row.sonstiges?.trim() ? `Zusatzinfo: ${row.sonstiges.trim()}` : "",
    row.kommentar?.trim() ? row.kommentar.trim() : "",
  ].filter(Boolean);
  return optionalUndefined(details.join(" · "));
}

function consignmentHistoricalCsvInfo(row: ImportRow): string[] {
  return [
    row.mm_stk?.trim() ? `CSV: MM Stk.: ${row.mm_stk.trim()}` : "",
    row.lager?.trim() ? `CSV: Lager: ${row.lager.trim()}` : "",
    row.retoure?.trim() ? `CSV: Historische Retoure: ${row.retoure.trim()}` : "",
  ].filter(Boolean);
}

async function loadImportContext(
  tx: Tx,
  organizationId: string,
  table: TableKey,
  rows: ImportRow[]
): Promise<ImportContext> {
  const needsInventory = table === "verkauf";
  const needsSales = table === "retouren";
  const needsProducts = table === "produkte";
  const productNames = [...new Set(rows.map((row) => row.name?.trim()).filter(Boolean))] as string[];
  const [inventoryRefs, products, saleRefs] = await Promise.all([
    needsInventory
      ? tx.sourceReference.findMany({
          where: { organizationId, targetEntity: "INVENTORY_POSITION" },
          select: { legacyReference: true, targetEntityId: true },
        })
      : Promise.resolve([]),
    needsProducts && productNames.length > 0
      ? tx.product.findMany({
          where: {
            organizationId,
            name: { in: productNames, mode: "insensitive" },
          },
          select: { name: true, variant: true },
        })
      : Promise.resolve([]),
    needsSales
      ? tx.sourceReference.findMany({
          where: { organizationId, targetEntity: "SALE" },
          select: { legacyReference: true, targetEntityId: true },
        })
      : Promise.resolve([]),
  ]);
  const positions = needsInventory
    ? await tx.inventoryPosition.findMany({
        where: { organizationId, id: { in: inventoryRefs.map((ref) => ref.targetEntityId) } },
        include: { ownedLot: true, consignmentLot: true },
      })
    : [];
  const byPosition = new Map(positions.map((position) => [position.id, position]));
  const inventoryByLegacy = new Map<string, ImportInventoryMapping>();
  for (const ref of inventoryRefs) {
    if (!ref.legacyReference) continue;
    const position = byPosition.get(ref.targetEntityId);
    if (!position) continue;
    const unitCost = position.ownedLot?.unitPriceNet ?? position.consignmentLot?.costNet ?? null;
    inventoryByLegacy.set(normalizeLegacy(ref.legacyReference), {
      inventoryPositionId: position.id,
      inventoryNumber: position.inventoryNumber,
      inventoryType: position.inventoryType,
      quantityAvailable: position.quantityAvailable,
      unitCostNetCents: decimalToCents(unitCost),
    });
  }
  const saleByLegacy = new Map<string, { saleId: string }>();
  saleRefs.forEach((ref) => {
    if (ref.legacyReference) saleByLegacy.set(normalizeLegacy(ref.legacyReference), { saleId: ref.targetEntityId });
  });
  return {
    inventoryByLegacy,
    saleByLegacy,
    productKeys: new Set(
      products.map((product) => productImportKey(product.name, product.variant ?? undefined))
    ),
  };
}

async function loadExistingRowHashes(tx: Tx, organizationId: string, rows: ImportRow[]): Promise<Set<string>> {
  const hashes = rows.map(hashRow);
  const existing = await tx.sourceReference.findMany({
    where: { organizationId, rowHash: { in: hashes } },
    select: { rowHash: true },
  });
  return new Set(existing.map((row) => row.rowHash));
}

async function createSourceReference(
  tx: Tx,
  input: {
    organizationId: string;
    batchId: string;
    sheetName?: string;
    planned: PlannedRow;
    targetEntity: ImportTargetEntity;
    targetEntityId: string;
    status: ImportRowStatus;
  }
) {
  await tx.sourceReference.create({
    data: sourceReferenceData(input),
  });
}

function sourceReferenceData(input: {
  organizationId: string;
  batchId: string;
  sheetName?: string;
  planned: PlannedRow;
  targetEntity: ImportTargetEntity;
  targetEntityId: string;
  status: ImportRowStatus;
}): Prisma.SourceReferenceCreateManyInput {
  return {
    organizationId: input.organizationId,
    importBatchId: input.batchId,
    sheetName: input.sheetName?.trim() || "Import",
    rowNumber: input.planned.rowNumber,
    rowHash: input.planned.rowHash,
    targetEntity: input.targetEntity,
    targetEntityId: input.targetEntityId,
    legacyReference: input.planned.legacyReference,
    status: input.status,
    warnings: input.planned.warnings ?? [],
    errors: [],
  };
}

async function resolvePlatform(tx: Tx, organizationId: string, name: string) {
  const label = name.trim() || "Sonstiges";
  const existing = await tx.platform.findFirst({ where: { organizationId, name: label } });
  if (existing) return existing;
  return tx.platform.create({ data: { organizationId, name: label } });
}

async function resolveProduct(
  tx: Tx,
  organizationId: string,
  name: string,
  variant?: string,
  size?: string,
  ean?: string
) {
  const normalizedName = name.trim() || "Importierter Artikel";
  const product = await tx.product.findFirst({
    where: { organizationId, name: normalizedName, variant: optional(variant) },
  });
  if (product) return product;
  return tx.product.create({
    data: {
      organizationId,
      name: normalizedName,
      variant: optional(variant),
      size: optional(size),
      ean: optional(ean),
    },
  });
}

function addReview(summary: ImportSummary, item: ImportReviewItem) {
  summary.review.push(item);
  incrementStatus(summary, item.status, 1);
  if (item.targetEntity) {
    summary.targetCounts[item.targetEntity] = (summary.targetCounts[item.targetEntity] ?? 0) + 1;
  }
}

function updateReview(
  summary: ImportSummary,
  rowNumber: number,
  patch: Pick<ImportReviewItem, "status" | "message"> & Pick<Partial<ImportReviewItem>, "warnings" | "errors">
) {
  const item = summary.review.find((reviewItem) => reviewItem.row === rowNumber);
  if (!item) return;
  incrementStatus(summary, item.status, -1);
  item.status = patch.status;
  item.message = patch.message;
  item.warnings = patch.warnings;
  item.errors = patch.errors;
  incrementStatus(summary, item.status, 1);
}

function incrementStatus(summary: ImportSummary, status: ImportRowStatus, amount: 1 | -1) {
  if (status === "UNCHANGED") summary.unchanged += amount;
  else if (status === "UPDATE_AVAILABLE") summary.updateAvailable += amount;
  else if (status === "NEW") summary.newRows += amount;
  else if (status === "CONFLICT") summary.conflicts += amount;
  else if (status === "LINKED") summary.linked += amount;
  else if (status === "PARTIALLY_LINKED") summary.partiallyLinked += amount;
  else if (status === "UNRESOLVED") summary.unresolved += amount;
  else if (status === "REVIEW_REQUIRED") summary.reviewRequired += amount;
  else if (status === "ERROR") summary.errors += amount;
}

function relationStatusFor(totalRefs: number, linkedRefs: number): "LINKED" | "PARTIALLY_LINKED" | "UNRESOLVED" {
  if (totalRefs === 0 || linkedRefs === 0) return "UNRESOLVED";
  if (linkedRefs === totalRefs) return "LINKED";
  return "PARTIALLY_LINKED";
}

function normalizeMetadata(table: TableKey, rows: ImportRow[], metadata?: ImportMetadata): Required<ImportMetadata> {
  const hash = metadata?.fileHash || hashString(JSON.stringify({ table, rows }));
  return {
    fileName: metadata?.fileName || `${table}-import`,
    fileHash: hash,
    sheetName: metadata?.sheetName || "Import",
  };
}

function primaryLegacyReference(table: TableKey, row: ImportRow, rowNumber: number): string {
  let value: string | undefined;
  switch (table) {
    case "produkte": value = productImportKey(row.name, row.variant); break;
    case "lager": value = row.lagerid; break;
    case "verkauf":
    case "retouren": value = row.orderid; break;
    case "konsignation": value = row.nr || row.sku; break;
    case "schulden": value = row.refid; break;
    case "aufgaben": value = undefined; break;
  }
  return normalizeLegacy(value) || `${table}:row:${rowNumber}`;
}

function hashRow(row: ImportRow): string {
  const canonical = Object.keys(row)
    .filter((key) => !["import_resolution", "resolved_lagerids"].includes(key))
    .sort()
    .map((key) => [key, row[key]?.trim() ?? ""])
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
  return hashString(canonical);
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseDateFlexible(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const text = value.trim();
  let match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return new Date(year, Number(match[2]) - 1, Number(match[1]));
  }
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseEuroTolerant(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  try {
    return euroToCents(value);
  } catch {
    return null;
  }
}

function requiredCents(value: string | undefined): number {
  const cents = parseEuroTolerant(value);
  if (cents == null) throw new Error(`Ungültiger Betrag: ${value ?? ""}`);
  return cents;
}

function parseBoolTolerant(value: string | undefined): boolean {
  return ["true", "wahr", "ja", "x", "1", "yes", "✓"].includes(normalize(value));
}

function parseIntSafe(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickEntry(value: string | undefined, fallback: "E" | "O" | "NN" | "S"): "E" | "O" | "NN" | "S" {
  const normalized = normalize(value);
  if (normalized === "e" || normalized === "eingetragen") return "E";
  if (normalized === "nn" || normalized === "nicht nötig") return "NN";
  if (normalized === "s") return "S";
  if (normalized === "o" || normalized === "offen") return "O";
  return fallback;
}

function saleStatus(value: string | undefined): SaleStatus {
  const normalized = normalize(value);
  if (normalized.includes("bezahlt")) return "PAID";
  if (normalized.includes("versendet")) return "SHIPPED";
  if (normalized.includes("abgeschlossen") || normalized.includes("erledigt")) return "COMPLETED";
  if (normalized.includes("storniert")) return "CANCELLED";
  return "PENDING";
}

function returnStatus(value: string | undefined): ReturnStatus {
  const normalized = normalize(value);
  if (normalized.includes("storniert")) return "REJECTED";
  if (normalized.includes("gelagert")) return "RESTOCKED";
  if (normalized.includes("erstattet")) return "REFUNDED";
  if (normalized.includes("konflikt")) return "CONFLICT";
  return "REQUESTED";
}

function invoiceDone(value: string | undefined): boolean {
  return ["erledigt", "ja", "true", "x", "✓"].includes(normalize(value));
}

function importComment(group: PlannedRow[]): string {
  return `Import Legacy: ${group.map((item) => item.legacyReference).join(", ")}`;
}

function legacyNote(legacy: string | undefined, comment: string | undefined): string | null {
  return [legacy ? `Legacy: ${legacy}` : null, optional(comment)].filter(Boolean).join(" · ") || null;
}

function decimalToCents(value: Prisma.Decimal | null): number {
  return value ? Math.round(Number(value) * 100) : 0;
}

function normalizeDateKey(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function normalizeHeader(value: string): string {
  return normalize(value).replace(/\s+/g, " ");
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeLegacy(value: string | undefined | null): string {
  return value?.trim().toUpperCase() ?? "";
}

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalUndefined(value: string | undefined): string | undefined {
  return optional(value) ?? undefined;
}

function productImportKey(name: string | undefined, variant: string | undefined): string {
  return `${normalize(name)}|${normalize(variant)}`;
}

function parseImageUrls(value: string | undefined): string[] {
  return splitImageUrls(value).filter(isValidHttpsUrl);
}

function splitImageUrls(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[;,\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function cloneSummary(): ImportSummary {
  return {
    ...EMPTY_SUMMARY,
    targetCounts: {},
    review: [],
  };
}
