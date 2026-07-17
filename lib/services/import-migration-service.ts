import { createHash } from "crypto";
import type {
  ImportRowStatus,
  ImportTargetEntity,
  ItemCondition,
  Prisma,
  ReceiptInspectionStatus,
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
  createPurchaseOrder,
  effectiveReceivedQuantity,
  receivePurchase,
} from "@/lib/services/owned-purchase-service";
import { createConsignmentStock } from "@/lib/services/consignment-service";
import { reserveDocumentNumber } from "@/lib/services/document-number-service";
import { sell } from "@/lib/services/inventory-service";
import { createManualDebt } from "@/lib/services/debt-service";
import { createSupplierReturn } from "@/lib/services/supplier-return-service";

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
    case "einkauf":
      importedCount = await commitPurchaseImport(input, batch.id, validRows);
      break;
    case "wareneingang":
      importedCount = await commitInboundImport(input, batch.id, validRows);
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
    case "kundenretouren":
      importedCount = await commitReturnsImport(input, batch.id, validRows, context);
      break;
    case "lieferantenretouren":
      importedCount = await commitSupplierReturnsImport(input, batch.id, validRows, context);
      break;
    case "schulden":
      importedCount = await commitDebtImport(input, batch.id, validRows);
      break;
    case "aufgaben":
      importedCount = await commitTaskImport(input, batch.id, validRows);
      break;
    case "ausgaben":
      importedCount = await commitExpenseImport(input, batch.id, validRows);
      break;
    case "gebuehrenregeln":
      importedCount = await commitFeeRuleImport(input, batch.id, validRows, context);
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
  const plannedFeeRuleKeys = new Set<string>();
  const plannedRowHashes = new Set<string>();
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
    if (plannedRowHashes.has(rowHash)) {
      addReview(summary, {
        row: rowNumber,
        status: "CONFLICT",
        message: "Identische Zeile kommt in dieser Datei mehrfach vor.",
        legacyReference,
      });
      return { row, rowNumber, rowHash, legacyReference, status: "CONFLICT" };
    }
    plannedRowHashes.add(rowHash);

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
    if (table === "gebuehrenregeln" && validation.status === "NEW") {
      const key = feeRuleKeyFromImportRow(row, context);
      if (key && plannedFeeRuleKeys.has(key)) {
        addReview(summary, {
          row: rowNumber,
          status: "CONFLICT",
          message: "Gültigkeits- und Geltungsbereich kommen in dieser Datei mehrfach vor.",
          legacyReference,
          targetEntity: "FEE_RULE",
        });
        return { row, rowNumber, rowHash, legacyReference, status: "CONFLICT" };
      }
      if (key) plannedFeeRuleKeys.add(key);
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

async function commitPurchaseImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[]
): Promise<number> {
  const groups = new Map<string, PlannedRow[]>();
  for (const planned of plannedRows) {
    const key = normalize(planned.row.bestellnummer) || `row:${planned.rowNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), planned]);
  }
  let imported = 0;
  for (const group of groups.values()) {
    const first = group[0].row;
    const created = await createPurchaseOrder({
      organizationId: input.organizationId,
      createdById: input.createdById,
      purchaseDate: parseDateFlexible(first.datum) ?? new Date(),
      vendor: first.lieferant.trim(),
      paymentMethod: first.zahlungsmethode?.trim() || "Firma",
      supplierOrderNumber: optionalUndefined(first.bestellnummer),
      expectedDeliveryAt: parseDateFlexible(first.erwartet) ?? undefined,
      trackingNumber: optionalUndefined(first.tracking),
      comment: importComment(group),
      lines: group.map(({ row }) => ({
        productName: row.artikel.trim(),
        variant: optionalUndefined(row.variante),
        quantity: parseIntSafe(row.menge) ?? 1,
        unitPriceGrossCents: requiredCents(row.preis),
        inputTaxDeductible: parseBoolTolerant(row.vst),
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
        comment: optionalUndefined(row.notiz),
      })),
      tx: input.tx,
    });
    for (const planned of group) {
      await createSourceReference(input.tx, {
        organizationId: input.organizationId,
        batchId,
        sheetName: input.metadata?.sheetName,
        planned,
        targetEntity: "PURCHASE",
        targetEntityId: created.purchase.id,
        status: "LINKED",
      });
      imported++;
    }
  }
  return imported;
}

async function commitInboundImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[]
): Promise<number> {
  let imported = 0;
  for (const planned of plannedRows) {
    const row = planned.row;
    let receiptId: string;
    if (row.einkaufsnummer?.trim()) {
      const purchase = await input.tx.purchase.findFirst({
        where: { organizationId: input.organizationId, purchaseNumber: row.einkaufsnummer.trim() },
        include: {
          lines: {
            include: {
              product: { select: { name: true } },
              receiptLines: { select: { quantity: true } },
              ownedLots: { select: { inventoryPosition: { select: { quantityReceived: true } } } },
            },
          },
        },
      });
      if (!purchase) throw new Error(`Einkauf ${row.einkaufsnummer} wurde im Mandanten nicht gefunden.`);
      const matches = purchase.lines.filter((line) =>
        normalize(line.product.name) === normalize(row.artikel) &&
        effectiveReceivedQuantity({
          receiptQuantities: line.receiptLines.map((item) => item.quantity),
          legacyLotQuantities: line.ownedLots.map((item) => item.inventoryPosition.quantityReceived),
        }) < line.quantity
      );
      if (matches.length !== 1) {
        throw new Error(`Artikel ${row.artikel} ist in ${row.einkaufsnummer} nicht eindeutig offen.`);
      }
      const received = await receivePurchase({
        organizationId: input.organizationId,
        createdById: input.createdById,
        purchaseId: purchase.id,
        receivedAt: parseDateFlexible(row.datum) ?? new Date(),
        returnDeadline: parseDateFlexible(row.rueckgabefrist) ?? undefined,
        trackingNumber: optionalUndefined(row.tracking),
        notes: optionalUndefined(row.notiz),
        lines: [{
          purchaseLineId: matches[0].id,
          quantity: parseIntSafe(row.menge) ?? 1,
          itemCondition: itemCondition(row.zustand),
          legacyCondition: optionalUndefined(row.zustand),
          inspectionStatus: inspectionStatus(row.pruefung),
          notes: optionalUndefined(row.notiz),
        }],
        tx: input.tx,
      });
      receiptId = received.receipt.id;
    } else {
      const created = await createOwnedPurchase({
        organizationId: input.organizationId,
        createdById: input.createdById,
        purchaseDate: parseDateFlexible(row.datum) ?? new Date(),
        vendor: row.lieferant.trim(),
        paymentMethod: row.zahlungsmethode?.trim() || "Firma",
        trackingNumber: optionalUndefined(row.tracking),
        returnDeadline: parseDateFlexible(row.rueckgabefrist) ?? undefined,
        comment: optionalUndefined(row.notiz),
        lines: [{
          productName: row.artikel.trim(),
          variant: optionalUndefined(row.variante),
          quantity: parseIntSafe(row.menge) ?? 1,
          unitPriceGrossCents: requiredCents(row.preis),
          inputTaxDeductible: parseBoolTolerant(row.vst),
          inputTaxRatePercent: 19,
          purchaseEntryStatus: "O",
          returnEntryStatus: "NN",
          itemCondition: itemCondition(row.zustand),
          legacyCondition: optionalUndefined(row.zustand),
          inspectionStatus: inspectionStatus(row.pruefung),
          comment: optionalUndefined(row.notiz),
        }],
        tx: input.tx,
      });
      receiptId = created.receipt.id;
    }
    await createSourceReference(input.tx, {
      organizationId: input.organizationId,
      batchId,
      sheetName: input.metadata?.sheetName,
      planned,
      targetEntity: "PURCHASE_RECEIPT",
      targetEntityId: receiptId,
      status: "LINKED",
    });
    imported++;
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
    const returnShipping = input.table === "kundenretouren"
      ? parseEuroTolerant(row.ruecksendekosten) ?? 0
      : extra;
    const loss = parseEuroTolerant(row.verlust) ?? calcReturnLoss({
      refundGrossCents: refund,
      taxRatePercent: Number(sale.taxRatePercent),
      saleGrossCents: sale.salePriceCents,
      platformFeeCents: sale.platformFeeNetCents,
      paymentFeeCents: 0,
      shippingCostCents: sale.shippingCostCents,
      extraCostCents: input.table === "kundenretouren" ? extra + returnShipping : extra,
    });
    const ret = await input.tx.return.create({
      data: {
        organizationId: input.organizationId,
        returnNumber,
        saleId: sale.id,
        requestedAt,
        reason: optional(row.ursache || row.grund || row.problem),
        refundAmountCents: refund,
        returnShippingCents: returnShipping,
        additionalCostsCents: input.table === "kundenretouren" ? extra : 0,
        trackingNumber: optional(row.tracking),
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

async function commitSupplierReturnsImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[],
  context: ImportContext
): Promise<number> {
  let imported = 0;
  for (const planned of plannedRows) {
    const row = planned.row;
    const selection = context.supplierReturnSelections.get(
      supplierReturnSelectionKey(row.einkaufsnummer, row.lagerid)
    );
    if (!selection) continue;
    const requestedAt = parseDateFlexible(row.meldedatum) ?? new Date();
    const supplierReturn = await createSupplierReturn({
      organizationId: input.organizationId,
      createdById: input.createdById,
      purchaseId: selection.purchaseId,
      requestedAt,
      returnDeadline: parseDateFlexible(row.frist),
      rmaNumber: optional(row.rma),
      expectedRefundCents: parseEuroTolerant(row.erwartete_erstattung) ?? 0,
      shippingCostCents: parseEuroTolerant(row.versandkosten) ?? 0,
      notes: optional(row.notiz),
      selections: [{
        purchaseLineId: selection.purchaseLineId,
        inventoryPositionId: selection.inventoryPositionId,
        sourceBucket: supplierReturnBucket(row.bucket),
        quantity: parseIntegerStrict(row.menge) ?? 0,
        reason: optional(row.grund),
        itemCondition: selection.itemCondition,
      }],
      tx: input.tx,
    });
    await createSourceReference(input.tx, {
      organizationId: input.organizationId,
      batchId,
      sheetName: input.metadata?.sheetName,
      planned,
      targetEntity: "SUPPLIER_RETURN",
      targetEntityId: supplierReturn.id,
      status: "LINKED",
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
    const assignee = planned.row.bearbeiter_email?.trim()
      ? await input.tx.membership.findFirst({
          where: {
            organizationId: input.organizationId,
            user: { email: { equals: planned.row.bearbeiter_email.trim(), mode: "insensitive" } },
          },
          select: { userId: true },
        })
      : null;
    const scope = parseBoolTolerant(planned.row.teamaufgabe) ? "TEAM" : "PERSONAL";
    const assignedUserId = assignee?.userId ?? (scope === "PERSONAL" ? input.createdById : null);
    const task = await input.tx.task.create({
      data: {
        organizationId: input.organizationId,
        title: planned.row.aufgabe?.trim() || "Importierte Aufgabe",
        description: optional(planned.row.anmerkung),
        area: optional(planned.row.bereich),
        priority: parseTaskPriority(planned.row.prioritaet),
        status: parseTaskStatus(planned.row.status),
        dueDate: parseDateFlexible(planned.row.frist),
        scope,
        assigneeId: assignedUserId,
        createdById: input.createdById,
        ...(assignedUserId ? { assignments: {
          create: [{
            organizationId: input.organizationId,
            userId: assignedUserId,
            role: "PRIMARY",
          }],
        } } : {}),
        activities: {
          create: {
            organizationId: input.organizationId,
            actorId: input.createdById,
            action: "IMPORTED",
            details: {
              source: "ImportBatch",
              assigneeEmail: planned.row.bearbeiter_email ?? null,
              recipientIds: assignedUserId ? [assignedUserId] : [],
            },
          },
        },
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

async function commitExpenseImport(input: ImportRunInput, batchId: string, plannedRows: PlannedRow[]): Promise<number> {
  let imported = 0;
  for (const planned of plannedRows) {
    const row = planned.row;
    const grossCents = requiredCents(row.brutto);
    const taxRatePercent = parsePercentTolerant(row.steuer) ?? 0;
    const netCents = parseEuroTolerant(row.netto) ?? grossToNetCents(grossCents, taxRatePercent);
    const category = row.kategorie?.trim()
      ? await input.tx.expenseCategory.upsert({
          where: { organizationId_name: { organizationId: input.organizationId, name: row.kategorie.trim() } },
          create: { organizationId: input.organizationId, name: row.kategorie.trim() },
          update: { active: true },
        })
      : null;
    const [supplier, paymentAccount, marketplaceAccount] = await Promise.all([
      row.lieferant?.trim() ? input.tx.businessPartner.findFirst({ where: { organizationId: input.organizationId, displayName: row.lieferant.trim() } }) : Promise.resolve(null),
      row.zahlungskonto?.trim() ? input.tx.payoutAccount.findFirst({ where: { organizationId: input.organizationId, displayName: row.zahlungskonto.trim() } }) : Promise.resolve(null),
      row.marktplatzkonto?.trim() ? input.tx.marketplaceAccount.findFirst({ where: { organizationId: input.organizationId, displayName: row.marktplatzkonto.trim() } }) : Promise.resolve(null),
    ]);
    const incurredAt = parseDateFlexible(row.zahlungsdatum)!;
    const recurring = normalize(row.art).startsWith("wieder") || normalize(row.art) === "recurring";
    const expense = await input.tx.expense.create({
      data: {
        organizationId: input.organizationId,
        categoryId: category?.id,
        supplierId: supplier?.id,
        paymentAccountId: paymentAccount?.id,
        marketplaceAccountId: marketplaceAccount?.id,
        description: row.bezeichnung.trim(),
        incurredAt,
        dueAt: parseDateFlexible(row.faelligkeit),
        paidAt: expenseStatus(row.status) === "POSTED" ? incurredAt : null,
        amountGross: centsToDecimalString(grossCents),
        amountNet: centsToDecimalString(netCents),
        taxRatePercent: taxRatePercent.toFixed(2),
        taxAmount: centsToDecimalString(grossCents - netCents),
        receiptReference: optional(row.beleg),
        notes: [
          optional(row.notiz),
          row.lieferant?.trim() && !supplier ? `Import-Lieferant: ${row.lieferant.trim()}` : null,
          row.zahlungskonto?.trim() && !paymentAccount ? `Import-Zahlungskonto: ${row.zahlungskonto.trim()}` : null,
          row.marktplatzkonto?.trim() && !marketplaceAccount ? `Import-Marktplatzkonto: ${row.marktplatzkonto.trim()}` : null,
        ].filter(Boolean).join(" · ") || null,
        status: expenseStatus(row.status),
      },
    });
    if (recurring) {
      const startsAt = parseDateFlexible(row.startdatum) ?? incurredAt;
      const rule = await input.tx.expenseRecurrenceRule.create({
        data: {
          organizationId: input.organizationId,
          expenseId: expense.id,
          interval: expenseInterval(row.intervall),
          startsAt,
          endsAt: parseDateFlexible(row.enddatum),
          nextOccurrenceAt: startsAt,
        },
      });
      await input.tx.expense.update({ where: { id: expense.id }, data: { occurrenceKey: `${rule.id}:${startsAt.toISOString().slice(0, 10)}` } });
    }
    await createSourceReference(input.tx, {
      organizationId: input.organizationId,
      batchId,
      sheetName: input.metadata?.sheetName,
      planned,
      targetEntity: "EXPENSE",
      targetEntityId: expense.id,
      status: "NEW",
    });
    imported++;
  }
  return imported;
}

async function commitFeeRuleImport(
  input: ImportRunInput,
  batchId: string,
  plannedRows: PlannedRow[],
  context: ImportContext
): Promise<number> {
  let imported = 0;
  for (const planned of plannedRows) {
    const row = planned.row;
    const platform = context.feePlatformsByName.get(normalize(row.plattform))!;
    const account = row.marktplatzkonto?.trim()
      ? context.feeAccountsByName.get(
          feeAccountImportKey(platform.id, row.marktplatzkonto)
        )
      : undefined;
    const record = await input.tx.feeRule.create({
      data: {
        organizationId: input.organizationId,
        platformId: platform.id,
        marketplaceAccountId: account?.id,
        category: optional(row.kategorie),
        itemCondition: itemCondition(row.zustand) ?? null,
        validFrom: parseDateFlexible(row.gueltig_ab)!,
        validUntil: parseDateFlexible(row.gueltig_bis),
        percentage: percentDecimal(row.prozent),
        fixedFeeCents: parseEuroTolerant(row.fix) ?? 0,
        minimumFeeCents: parseEuroTolerant(row.minimum),
        maximumFeeCents: parseEuroTolerant(row.maximum),
        advertisingPercent: percentDecimal(row.werbung),
        paymentFeePercent: percentDecimal(row.zahlungsgebuehr),
        vatTreatment: feeVatTreatment(row.ust_behandlung),
        priority: parseIntegerStrict(row.prioritaet) ?? 0,
        origin: "IMPORTED",
        source: optional(row.quelle) ?? input.metadata?.fileName ?? "Import",
        active: row.aktiv?.trim() ? parseBoolTolerant(row.aktiv) : true,
        metadata: {
          importedVia: "ImportBatch",
          sourceFile: input.metadata?.fileName ?? null,
        },
      },
    });
    await createSourceReference(input.tx, {
      organizationId: input.organizationId,
      batchId,
      sheetName: input.metadata?.sheetName,
      planned,
      targetEntity: "FEE_RULE",
      targetEntityId: record.id,
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
  purchaseByNumber: Map<string, {
    lines: Array<{ productName: string; quantity: number; receivedQuantity: number }>;
  }>;
  supplierReturnSelections: Map<string, SupplierReturnImportSelection>;
  taskMemberByEmail: Map<string, { userId: string; email: string }>;
  feePlatformsByName: Map<string, { id: string; name: string }>;
  feeAccountsByName: Map<string, { id: string; platformId: string; displayName: string }>;
  feeRuleKeys: Set<string>;
}

interface SupplierReturnImportSelection {
  purchaseId: string;
  purchaseLineId: string;
  inventoryPositionId: string;
  itemCondition: ItemCondition | null;
  quantities: Record<"AVAILABLE" | "RESERVED" | "INSPECTION" | "DEFECTIVE", number>;
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
  if (table === "einkauf" || table === "wareneingang") {
    if (!row.datum?.trim() || !parseDateFlexible(row.datum)) errors.push("Datum ist ungültig.");
    if (!row.lieferant?.trim()) errors.push("Lieferant fehlt.");
    if (!row.artikel?.trim()) errors.push("Artikel fehlt.");
    if ((parseIntSafe(row.menge) ?? 0) < 1) errors.push("Menge muss mindestens 1 sein.");
    needMoney("preis", "Preis");
    if (row.zustand?.trim() && !itemCondition(row.zustand)) errors.push("Zustand ist ungültig.");
    if (row.pruefung?.trim() && !["PASSED", "PENDING", "DEFECTIVE"].includes(row.pruefung.trim().toUpperCase())) errors.push("Prüfstatus ist ungültig.");
    if (row.rueckgabefrist?.trim() && !parseDateFlexible(row.rueckgabefrist)) errors.push("Rückgabefrist ist ungültig.");
    if (table === "wareneingang" && row.einkaufsnummer?.trim()) {
      const purchase = context.purchaseByNumber.get(normalize(row.einkaufsnummer));
      if (!purchase) {
        errors.push(`Einkauf ${row.einkaufsnummer} wurde im Mandanten nicht gefunden.`);
      } else {
        const matches = purchase.lines.filter((line) =>
          normalize(line.productName) === normalize(row.artikel) &&
          line.receivedQuantity < line.quantity
        );
        if (matches.length !== 1) {
          errors.push(`Artikel ${row.artikel} ist in ${row.einkaufsnummer} nicht eindeutig offen.`);
        } else if ((parseIntSafe(row.menge) ?? 0) > matches[0].quantity - matches[0].receivedQuantity) {
          errors.push("Eingangsmenge überschreitet die offene Bestellmenge.");
        }
      }
    }
    return {
      status: errors.length ? "ERROR" : "NEW",
      message: table === "einkauf" ? "Neue Bestellung wird importiert." : row.einkaufsnummer?.trim() ? "Wareneingang wird mit Einkauf verknüpft." : "Direkter Wareneingang wird importiert.",
      warnings,
      errors,
      targetEntity: table === "einkauf" ? "PURCHASE" : "PURCHASE_RECEIPT",
    };
  }
  if (table === "verkauf") {
    needMoney("vk_brutto", "VK brutto");
    const refs = saleStockReferences(row);
    const linked = refs.filter((ref) => context.inventoryByLegacy.has(ref)).length;
    const status = relationStatusFor(refs.length, linked);
    if (status === "UNRESOLVED") warnings.push("Kein eindeutiger Bestandsbezug; Verkauf wird historisch ohne Allocation importiert.");
    return { status, message: `${linked}/${refs.length} Bestandsreferenzen verknüpft.`, warnings, errors, targetEntity: "SALE" };
  }
  if (table === "retouren" || table === "kundenretouren") {
    if (!context.saleByLegacy.has(normalizeLegacy(row.orderid))) {
      errors.push(`Kein importierter Verkauf zu OrderID "${row.orderid ?? ""}" gefunden.`);
    }
    return { status: errors.length ? "ERROR" : "PARTIALLY_LINKED", message: "Retoure wird mit Verkauf verknüpft.", warnings, errors, targetEntity: "RETURN" };
  }
  if (table === "lieferantenretouren") {
    const selection = context.supplierReturnSelections.get(
      supplierReturnSelectionKey(row.einkaufsnummer, row.lagerid)
    );
    if (!selection) errors.push("Einkaufsnummer und LagerID konnten in dieser Organisation nicht gemeinsam aufgelöst werden.");
    const quantity = parseIntegerStrict(row.menge) ?? 0;
    if (quantity < 1) errors.push("Menge muss mindestens 1 sein.");
    const bucket = supplierReturnBucket(row.bucket);
    if (row.bucket?.trim() && !["AVAILABLE", "RESERVED", "INSPECTION", "DEFECTIVE"].includes(row.bucket.trim().toUpperCase())) {
      errors.push("Bestands-Bucket ist ungültig.");
    }
    if (selection && quantity > selection.quantities[bucket]) {
      errors.push(`Im Bucket ${bucket} sind nur ${selection.quantities[bucket]} Stück verfügbar.`);
    }
    if (!row.grund?.trim()) errors.push("Rückgabegrund fehlt.");
    if (row.meldedatum?.trim() && !parseDateFlexible(row.meldedatum)) errors.push("Meldedatum ist ungültig.");
    if (row.frist?.trim() && !parseDateFlexible(row.frist)) errors.push("Rückgabefrist ist ungültig.");
    if (row.erwartete_erstattung?.trim()) {
      const amount = parseEuroTolerant(row.erwartete_erstattung);
      if (amount == null || amount < 0) errors.push("Erwartete Erstattung ist ungültig.");
    }
    if (row.versandkosten?.trim()) {
      const amount = parseEuroTolerant(row.versandkosten);
      if (amount == null || amount < 0) errors.push("Versandkosten ist ungültig.");
    }
    return { status: errors.length ? "ERROR" : "LINKED", message: "Lieferantenretoure wird mit Einkauf und Lot verknüpft.", warnings, errors, targetEntity: "SUPPLIER_RETURN" };
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
  if (table === "ausgaben") {
    if (!row.bezeichnung?.trim()) errors.push("Bezeichnung fehlt.");
    if (!row.zahlungsdatum?.trim() || !parseDateFlexible(row.zahlungsdatum)) errors.push("Zahlungsdatum ist ungültig.");
    needMoney("brutto", "Betrag brutto");
    if (row.netto?.trim() && parseEuroTolerant(row.netto) === null) errors.push("Betrag netto ist ungültig.");
    const grossCents = parseEuroTolerant(row.brutto);
    const netCents = parseEuroTolerant(row.netto);
    if (grossCents !== null && netCents !== null && netCents > grossCents) errors.push("Betrag netto darf Betrag brutto nicht überschreiten.");
    if (row.steuer?.trim() && parsePercentTolerant(row.steuer) === null) errors.push("Steuersatz ist ungültig.");
    const recurring = normalize(row.art).startsWith("wieder") || normalize(row.art) === "recurring";
    if (!recurring && !["einmalig", "one_time", "one-time"].includes(normalize(row.art))) errors.push("Art muss Einmalig oder Wiederkehrend sein.");
    if (recurring && row.intervall?.trim() && !["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"].includes(row.intervall.trim().toUpperCase())) errors.push("Intervall ist ungültig.");
    const startsAt = parseDateFlexible(row.startdatum);
    const endsAt = parseDateFlexible(row.enddatum);
    if (row.startdatum?.trim() && !startsAt) errors.push("Startdatum ist ungültig.");
    if (row.enddatum?.trim() && !endsAt) errors.push("Enddatum ist ungültig.");
    if (startsAt && endsAt && endsAt <= startsAt) errors.push("Enddatum muss nach dem Startdatum liegen.");
    if (row.faelligkeit?.trim() && !parseDateFlexible(row.faelligkeit)) errors.push("Fälligkeit ist ungültig.");
    return { status: errors.length ? "ERROR" : "NEW", message: recurring ? "Wiederkehrende Ausgabe wird importiert." : "Einmalige Ausgabe wird importiert.", warnings, errors, targetEntity: "EXPENSE" };
  }
  if (table === "gebuehrenregeln") {
    const platform = context.feePlatformsByName.get(normalize(row.plattform));
    if (!platform) errors.push(`Plattform "${row.plattform ?? ""}" wurde in dieser Organisation nicht eindeutig gefunden.`);
    const account = platform && row.marktplatzkonto?.trim()
      ? context.feeAccountsByName.get(
          feeAccountImportKey(platform.id, row.marktplatzkonto)
        )
      : undefined;
    if (row.marktplatzkonto?.trim() && !account) {
      errors.push(`Marktplatzkonto "${row.marktplatzkonto.trim()}" gehört nicht eindeutig zur angegebenen Plattform.`);
    }
    const validFrom = parseDateFlexible(row.gueltig_ab);
    const validUntil = parseDateFlexible(row.gueltig_bis);
    if (!validFrom) errors.push("Gültig ab ist ungültig.");
    if (row.gueltig_bis?.trim() && !validUntil) errors.push("Gültig bis ist ungültig.");
    if (validFrom && validUntil && validUntil < validFrom) errors.push("Gültig bis darf nicht vor Gültig ab liegen.");
    validatePercentField(row.prozent, "Prozentuale Gebühr", errors, true);
    validatePercentField(row.werbung, "Werbegebühr", errors);
    validatePercentField(row.zahlungsgebuehr, "Zahlungsgebühr", errors);
    for (const [field, label] of [["fix", "Fixe Gebühr"], ["minimum", "Mindestwert"], ["maximum", "Maximalwert"]] as const) {
      const amount = row[field]?.trim() ? parseEuroTolerant(row[field]) : 0;
      if (amount === null || amount < 0) errors.push(`${label} ist ungültig.`);
    }
    const minimum = parseEuroTolerant(row.minimum);
    const maximum = parseEuroTolerant(row.maximum);
    if (minimum !== null && maximum !== null && maximum < minimum) {
      errors.push("Maximalwert darf nicht kleiner als Mindestwert sein.");
    }
    if (row.zustand?.trim() && !itemCondition(row.zustand)) errors.push("Artikelzustand ist ungültig.");
    if (row.ust_behandlung?.trim() && !["INCLUDED", "EXCLUDED", "UNKNOWN"].includes(row.ust_behandlung.trim().toUpperCase())) {
      errors.push("USt-Behandlung ist ungültig.");
    }
    if (row.prioritaet?.trim() && parseIntegerStrict(row.prioritaet) === null) errors.push("Priorität muss eine Ganzzahl sein.");
    if (row.aktiv?.trim() && !isBooleanValue(row.aktiv)) errors.push("Aktiv muss Ja oder Nein sein.");
    const key = feeRuleKeyFromImportRow(row, context);
    const duplicate = key ? context.feeRuleKeys.has(key) : false;
    return {
      status: errors.length ? "ERROR" : duplicate ? "CONFLICT" : "NEW",
      message: duplicate
        ? "Eine Gebührenregel mit gleichem Gültigkeits- und Geltungsbereich existiert bereits."
        : "Neue Gebührenregel wird importiert.",
      warnings,
      errors,
      targetEntity: "FEE_RULE",
    };
  }
  if (table === "aufgaben") {
    if (!row.aufgabe?.trim()) errors.push("Aufgabe fehlt.");
    if (row.aufgabe?.trim().length > 300) errors.push("Titel darf maximal 300 Zeichen lang sein.");
    if (row.frist?.trim() && !parseDateFlexible(row.frist)) errors.push("Frist ist ungültig.");
    if (row.prioritaet?.trim() && !isTaskPriorityValue(row.prioritaet)) errors.push("Priorität ist ungültig.");
    if (row.status?.trim() && !isTaskStatusValue(row.status)) errors.push("Status ist ungültig.");
    if (row.teamaufgabe?.trim() && !isBooleanValue(row.teamaufgabe)) errors.push("Teamaufgabe muss Ja oder Nein sein.");
    if (row.bearbeiter_email?.trim() && !context.taskMemberByEmail.has(normalize(row.bearbeiter_email))) {
      errors.push(`Bearbeiter ${row.bearbeiter_email.trim()} ist kein aktives Mitglied dieser Organisation.`);
    }
  }
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
  const needsSales = table === "retouren" || table === "kundenretouren";
  const needsProducts = table === "produkte";
  const purchaseNumbers = table === "wareneingang"
    ? [...new Set(rows.map((row) => row.einkaufsnummer?.trim()).filter(Boolean))] as string[]
    : [];
  const supplierInventoryNumbers = table === "lieferantenretouren"
    ? [...new Set(rows.map((row) => row.lagerid?.trim()).filter(Boolean))] as string[]
    : [];
  const productNames = [...new Set(rows.map((row) => row.name?.trim()).filter(Boolean))] as string[];
  const [inventoryRefs, products, saleRefs, purchases, supplierPositions, taskMembers, feePlatforms, feeAccounts, feeRules] = await Promise.all([
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
    purchaseNumbers.length > 0
      ? tx.purchase.findMany({
          where: { organizationId, purchaseNumber: { in: purchaseNumbers } },
          select: {
            purchaseNumber: true,
            lines: {
              select: {
                quantity: true,
                product: { select: { name: true } },
                receiptLines: { select: { quantity: true } },
                ownedLots: { select: { inventoryPosition: { select: { quantityReceived: true } } } },
              },
            },
          },
        })
      : Promise.resolve([]),
    supplierInventoryNumbers.length > 0
      ? tx.inventoryPosition.findMany({
          where: { organizationId, inventoryType: "OWNED", inventoryNumber: { in: supplierInventoryNumbers } },
          include: { ownedLot: { include: { purchaseLine: { include: { purchase: true } } } } },
        })
      : Promise.resolve([]),
    table === "aufgaben"
      ? tx.membership.findMany({
          where: { organizationId },
          select: { userId: true, user: { select: { email: true } } },
        })
      : Promise.resolve([]),
    table === "gebuehrenregeln"
      ? tx.platform.findMany({
          where: { organizationId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    table === "gebuehrenregeln"
      ? tx.marketplaceAccount.findMany({
          where: { organizationId },
          select: { id: true, platformId: true, displayName: true },
        })
      : Promise.resolve([]),
    table === "gebuehrenregeln"
      ? tx.feeRule.findMany({
          where: { organizationId },
          select: {
            platformId: true,
            marketplaceAccountId: true,
            category: true,
            itemCondition: true,
            validFrom: true,
          },
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
    purchaseByNumber: new Map(purchases.map((purchase) => [
      normalize(purchase.purchaseNumber),
      {
        lines: purchase.lines.map((line) => ({
          productName: line.product.name,
          quantity: line.quantity,
          receivedQuantity: effectiveReceivedQuantity({
            receiptQuantities: line.receiptLines.map((item) => item.quantity),
            legacyLotQuantities: line.ownedLots.map((item) => item.inventoryPosition.quantityReceived),
          }),
        })),
      },
    ])),
    supplierReturnSelections: new Map(supplierPositions.flatMap((position) => {
      const purchaseLine = position.ownedLot?.purchaseLine;
      if (!purchaseLine) return [];
      return [[supplierReturnSelectionKey(purchaseLine.purchase.purchaseNumber, position.inventoryNumber), {
        purchaseId: purchaseLine.purchaseId,
        purchaseLineId: purchaseLine.id,
        inventoryPositionId: position.id,
        itemCondition: position.itemCondition,
        quantities: {
          AVAILABLE: position.quantityAvailable,
          RESERVED: position.quantityReserved,
          INSPECTION: position.quantityInspection,
          DEFECTIVE: position.quantityDefective,
        },
      }]];
    })),
    taskMemberByEmail: new Map(taskMembers.map((membership) => [
      normalize(membership.user.email),
      { userId: membership.userId, email: membership.user.email },
    ])),
    feePlatformsByName: new Map(
      feePlatforms.map((platform) => [normalize(platform.name), platform])
    ),
    feeAccountsByName: new Map(
      feeAccounts.map((account) => [
        feeAccountImportKey(account.platformId, account.displayName),
        account,
      ])
    ),
    feeRuleKeys: new Set(
      feeRules.map((rule) => feeRuleImportKey({
        platformId: rule.platformId,
        marketplaceAccountId: rule.marketplaceAccountId,
        category: rule.category ?? undefined,
        condition: rule.itemCondition,
        validFrom: rule.validFrom,
      }))
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
    case "einkauf": value = row.bestellnummer; break;
    case "wareneingang": value = row.einkaufsnummer || `${row.datum}:${row.lieferant}:${row.artikel}`; break;
    case "lager": value = row.lagerid; break;
    case "verkauf":
    case "retouren":
    case "kundenretouren": value = row.orderid; break;
    case "lieferantenretouren": value = `${row.einkaufsnummer}:${row.lagerid}:${row.rma || row.grund}`; break;
    case "konsignation": value = row.nr || row.sku; break;
    case "schulden": value = row.refid; break;
    case "aufgaben": value = undefined; break;
    case "ausgaben": value = `${row.zahlungsdatum}:${row.bezeichnung}:${row.brutto}`; break;
    case "gebuehrenregeln": value = `${row.plattform}:${row.marktplatzkonto ?? ""}:${row.kategorie ?? ""}:${row.zustand ?? ""}:${row.gueltig_ab}`; break;
  }
  return normalizeLegacy(value) || `${table}:row:${rowNumber}`;
}

function supplierReturnSelectionKey(purchaseNumber?: string, inventoryNumber?: string): string {
  return `${normalize(purchaseNumber)}:${normalize(inventoryNumber)}`;
}

function supplierReturnBucket(value?: string): "AVAILABLE" | "RESERVED" | "INSPECTION" | "DEFECTIVE" {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "RESERVED" || normalized === "INSPECTION" || normalized === "DEFECTIVE") return normalized;
  return "AVAILABLE";
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
    return calendarDate(year, Number(match[2]), Number(match[1]));
  }
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return calendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
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

function parsePercentTolerant(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function validatePercentField(
  value: string | undefined,
  label: string,
  errors: string[],
  required = false
): void {
  if (!value?.trim()) {
    if (required) errors.push(`${label} fehlt.`);
    return;
  }
  const parsed = parsePercentTolerant(value);
  if (parsed === null || parsed > 100) errors.push(`${label} muss zwischen 0 und 100 liegen.`);
}

function percentDecimal(value: string | undefined): string {
  return (parsePercentTolerant(value) ?? 0).toFixed(4);
}

function feeVatTreatment(value: string | undefined): "INCLUDED" | "EXCLUDED" | "UNKNOWN" {
  const normalized = value?.trim().toUpperCase();
  return normalized === "INCLUDED" || normalized === "EXCLUDED" ? normalized : "UNKNOWN";
}

function feeAccountImportKey(platformId: string, displayName: string | undefined): string {
  return `${platformId}:${normalize(displayName)}`;
}

function feeRuleImportKey(input: {
  platformId: string;
  marketplaceAccountId: string | null;
  category: string | undefined;
  condition: ItemCondition | null;
  validFrom: Date;
}): string {
  return [
    input.platformId,
    input.marketplaceAccountId ?? "",
    normalize(input.category),
    input.condition ?? "",
    [
      input.validFrom.getFullYear(),
      String(input.validFrom.getMonth() + 1).padStart(2, "0"),
      String(input.validFrom.getDate()).padStart(2, "0"),
    ].join("-"),
  ].join(":");
}

function feeRuleKeyFromImportRow(
  row: ImportRow,
  context: ImportContext
): string | null {
  const platform = context.feePlatformsByName.get(normalize(row.plattform));
  const validFrom = parseDateFlexible(row.gueltig_ab);
  if (!platform || !validFrom) return null;
  const account = row.marktplatzkonto?.trim()
    ? context.feeAccountsByName.get(
        feeAccountImportKey(platform.id, row.marktplatzkonto)
      )
    : undefined;
  return feeRuleImportKey({
    platformId: platform.id,
    marketplaceAccountId: account?.id ?? null,
    category: row.kategorie,
    condition: itemCondition(row.zustand) ?? null,
    validFrom,
  });
}

function expenseStatus(value: string | undefined): "DRAFT" | "POSTED" | "CANCELLED" {
  const normalized = value?.trim().toUpperCase();
  return normalized === "POSTED" || normalized === "CANCELLED" ? normalized : "DRAFT";
}

function expenseInterval(value: string | undefined): "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR" {
  const normalized = value?.trim().toUpperCase();
  switch (normalized) {
    case "DAY":
    case "WEEK":
    case "MONTH":
    case "QUARTER":
    case "YEAR":
      return normalized;
    default:
      return "MONTH";
  }
}

function parseTaskPriority(value: string | undefined): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  const normalized = normalize(value);
  if (["urgent", "dringend", "kritisch"].includes(normalized)) return "URGENT";
  if (["high", "hoch"].includes(normalized)) return "HIGH";
  if (["low", "niedrig"].includes(normalized)) return "LOW";
  return "MEDIUM";
}

function isTaskPriorityValue(value: string): boolean {
  return ["urgent", "dringend", "kritisch", "high", "hoch", "medium", "mittel", "normal", "low", "niedrig"].includes(normalize(value));
}

function parseTaskStatus(value: string | undefined): "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED" {
  const normalized = normalize(value).replace(/[_-]+/g, " ");
  if (["in progress", "in arbeit", "bearbeitung"].includes(normalized)) return "IN_PROGRESS";
  if (["done", "erledigt", "abgeschlossen"].includes(normalized)) return "DONE";
  if (["cancelled", "canceled", "abgebrochen", "storniert"].includes(normalized)) return "CANCELLED";
  return "OPEN";
}

function isTaskStatusValue(value: string): boolean {
  return ["open", "offen", "in progress", "in arbeit", "bearbeitung", "done", "erledigt", "abgeschlossen", "cancelled", "canceled", "abgebrochen", "storniert"].includes(normalize(value).replace(/[_-]+/g, " "));
}

function isBooleanValue(value: string): boolean {
  return ["true", "false", "wahr", "falsch", "ja", "nein", "x", "1", "0", "yes", "no", "✓"].includes(normalize(value));
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

function parseIntegerStrict(value: string | undefined): number | null {
  if (!value?.trim() || !/^[+-]?\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function calendarDate(year: number, month: number, day: number): Date | null {
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? parsed
    : null;
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

function itemCondition(value: string | undefined): ItemCondition | undefined {
  const normalized = value?.trim().toUpperCase();
  return normalized && ["NEW", "OPEN_BOX", "REFURBISHED", "USED", "DEFECTIVE"].includes(normalized)
    ? normalized as ItemCondition
    : undefined;
}

function inspectionStatus(value: string | undefined): ReceiptInspectionStatus {
  const normalized = value?.trim().toUpperCase();
  return normalized && ["PASSED", "PENDING", "DEFECTIVE"].includes(normalized)
    ? normalized as ReceiptInspectionStatus
    : "PASSED";
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
