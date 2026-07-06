"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type {
  DebtEntry,
  DebtKind,
  DebtStatus,
  EntryStatus,
  ReturnStatus,
  StockItemStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  calcPurchaseNetCents,
  calcReturnLoss,
  calcSale,
  euroToCents,
  feeNetCents,
  resolveTaxRatePercent,
} from "@/lib/calculations";
import { IMPORT_TABLES, type TableKey } from "@/lib/import-export";

export interface ImportResult {
  validCount: number;
  errors: Array<{ row: number; message: string }>;
  importedCount?: number;
  error?: string;
}

type Row = Record<string, string>;

// ---------------------------------------------------------------------------
// Tolerante Parser für Excel-Werte
// ---------------------------------------------------------------------------

function parseDateFlexible(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  // dd.mm.yyyy oder dd.mm.yy
  let m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(year, Number(m[2]) - 1, Number(m[1]));
  }
  // yyyy-mm-dd
  m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // m/d/yy (Excel-US)
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(year, Number(m[1]) - 1, Number(m[2]));
  }
  const parsed = new Date(v);
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

function parseBoolTolerant(value: string | undefined): boolean {
  if (!value) return false;
  return ["true", "wahr", "ja", "x", "1", "yes", "✓"].includes(
    value.trim().toLowerCase()
  );
}

function pick<T extends string>(
  value: string | undefined,
  map: Record<string, T>,
  fallback: T
): T {
  if (!value?.trim()) return fallback;
  return map[value.trim().toLowerCase()] ?? fallback;
}

const STOCK_STATUS_MAP: Record<string, StockItemStatus> = {
  verkauft: "SOLD",
  "gelagert - r": "STORED_R",
  "gelagert-r": "STORED_R",
  "gelagert - d": "STORED_D",
  "gelagert-d": "STORED_D",
  gelagert: "IN_STOCK",
  retoure: "RETURNED",
  storniert: "CANCELLED",
  unterwegs: "IN_TRANSIT",
  sonstiges: "OTHER",
};

const ENTRY_MAP: Record<string, EntryStatus> = {
  e: "E",
  o: "O",
  nn: "NN",
  s: "S",
  eingetragen: "E",
  offen: "O",
  "nicht nötig": "NN",
};

const RETURN_STATUS_MAP: Record<string, ReturnStatus> = {
  angekündigt: "REQUESTED",
  angekuendigt: "REQUESTED",
  angemeldet: "REQUESTED",
  storniert: "REJECTED",
  gelagert: "RESTOCKED",
  erstattet: "REFUNDED",
  konflikt: "CONFLICT",
};

const DEBT_KIND_MAP: Record<string, DebtKind> = {
  kauf: "KAUF",
  verkauf: "VERKAUF",
  sonstiges: "SONSTIGES",
};

const DEBT_STATUS_MAP: Record<string, DebtStatus> = {
  offen: "OPEN",
  beglichen: "SETTLED",
  sonstiges: "OTHER",
};

const DEBT_ENTRY_MAP: Record<string, DebtEntry> = {
  "i.o": "IO",
  io: "IO",
  fehlt: "FEHLT",
};

const TASK_PRIO_MAP: Record<string, TaskPriority> = {
  hoch: "HIGH",
  mittel: "MEDIUM",
  niedrig: "LOW",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

const TASK_STATUS_MAP: Record<string, TaskStatus> = {
  offen: "OPEN",
  "in arbeit": "IN_PROGRESS",
  erledigt: "DONE",
};

// ---------------------------------------------------------------------------
// Import (Validierung + Insert in einem Rutsch, dryRun = nur prüfen)
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  table: z.enum(["lager", "verkauf", "retouren", "konsignation", "schulden", "aufgaben"]),
  dryRun: z.boolean(),
  rows: z.array(z.record(z.string(), z.string())).min(1, "Keine Zeilen gefunden.").max(2000, "Maximal 2000 Zeilen pro Import."),
});

export async function importRowsAction(
  table: TableKey,
  rows: Row[],
  dryRun: boolean
): Promise<ImportResult> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = requestSchema.safeParse({ table, dryRun, rows });
  if (!parsed.success) {
    return {
      validCount: 0,
      errors: [],
      error: parsed.error.issues[0]?.message ?? "Ungültige Anfrage.",
    };
  }

  const errors: Array<{ row: number; message: string }> = [];
  const fields = IMPORT_TABLES[table].fields;

  // Pflichtfelder generisch prüfen
  parsed.data.rows.forEach((row, index) => {
    for (const field of fields) {
      if (field.required && !row[field.key]?.trim()) {
        errors.push({ row: index + 1, message: `${field.label} fehlt.` });
      }
    }
  });

  let importedCount = 0;

  try {
    switch (table) {
      case "lager":
        importedCount = await importLager(parsed.data.rows, errors, dryRun, organization.id);
        break;
      case "verkauf":
        importedCount = await importVerkauf(parsed.data.rows, errors, dryRun, organization.id);
        break;
      case "retouren":
        importedCount = await importRetouren(parsed.data.rows, errors, dryRun, organization.id);
        break;
      case "konsignation":
        importedCount = await importKonsignation(parsed.data.rows, errors, dryRun, organization.id);
        break;
      case "schulden":
        importedCount = await importSchulden(parsed.data.rows, errors, dryRun, organization.id);
        break;
      case "aufgaben":
        importedCount = await importAufgaben(parsed.data.rows, errors, dryRun, organization.id, userId);
        break;
    }
  } catch (error) {
    return {
      validCount: 0,
      errors,
      error: error instanceof Error ? error.message : "Import fehlgeschlagen.",
    };
  }

  if (!dryRun && importedCount > 0) {
    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "import.run",
      entityType: "Import",
      after: { table, importedCount },
    });
    revalidatePath(`/${table === "verkauf" ? "verkauf" : table}`);
    revalidatePath("/lager");
    revalidatePath("/schulden");
  }

  void db; // requireOrg stellt den Tenant-Kontext sicher; Tabellen-Importer nutzen Transaktionen

  return {
    validCount: parsed.data.rows.length - new Set(errors.map((e) => e.row)).size,
    errors: errors.slice(0, 50),
    importedCount: dryRun ? undefined : importedCount,
  };
}

// --- Lager -----------------------------------------------------------------

async function importLager(
  rows: Row[],
  errors: Array<{ row: number; message: string }>,
  dryRun: boolean,
  organizationId: string
): Promise<number> {
  const prepared = rows
    .map((row, index) => {
      const grossCents = parseEuroTolerant(row.brutto);
      if (grossCents === null) {
        errors.push({ row: index + 1, message: `Ungültiger Brutto-Betrag: "${row.brutto ?? ""}"` });
        return null;
      }
      const vst = parseBoolTolerant(row.vst);
      return {
        sku: row.lagerid?.trim() || null,
        purchaseDate: parseDateFlexible(row.datum) ?? new Date(),
        supplier: row.haendler?.trim() || null,
        title: row.model.trim(),
        variant: row.colorway?.trim() || null,
        size: row.size?.trim() || null,
        purchasePriceCents: grossCents,
        purchaseNetCents: calcPurchaseNetCents(grossCents, vst, 19),
        inputTaxDeductible: vst,
        paymentMethod: row.zm?.trim() || "Firma",
        kaufStatus: pick(row.kauf, ENTRY_MAP, "O"),
        retoureStatus: pick(row.retoure, ENTRY_MAP, "NN"),
        status: pick(row.status, STOCK_STATUS_MAP, "IN_STOCK"),
        ean: row.ean?.trim() || null,
        notes: row.kommentar?.trim() || null,
        rowIndex: index + 1,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const errorRows = new Set(errors.map((e) => e.row));
  const valid = prepared.filter((r) => !errorRows.has(r.rowIndex));
  if (dryRun || valid.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    const needsIds = valid.filter((r) => !r.sku).length;
    let counter = 0;
    if (needsIds > 0) {
      const org = await tx.organization.update({
        where: { id: organizationId },
        data: { stockIdCounter: { increment: needsIds } },
      });
      counter = org.stockIdCounter - needsIds + 1;
    }
    for (const item of valid) {
      const sku =
        item.sku ??
        `L-${String(item.purchaseDate.getFullYear()).slice(-2)}-${String(counter++).padStart(3, "0")}`;
      const { rowIndex, ...data } = item;
      void rowIndex;
      await tx.stockItem.upsert({
        where: { organizationId_sku: { organizationId, sku } },
        create: { organizationId, ...data, sku, quantity: 1 },
        update: { ...data, sku },
      });
    }
  }, { timeout: 60000 });

  return valid.length;
}

// --- Verkauf -----------------------------------------------------------------

async function importVerkauf(
  rows: Row[],
  errors: Array<{ row: number; message: string }>,
  dryRun: boolean,
  organizationId: string
): Promise<number> {
  const prepared = rows
    .map((row, index) => {
      const grossCents = parseEuroTolerant(row.vk_brutto);
      if (grossCents === null) {
        errors.push({ row: index + 1, message: `Ungültiger VK brutto: "${row.vk_brutto ?? ""}"` });
        return null;
      }
      return { row, grossCents, rowIndex: index + 1 };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const errorRows = new Set(errors.map((e) => e.row));
  const valid = prepared.filter((r) => !errorRows.has(r.rowIndex));
  if (dryRun || valid.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    const taxRates = (
      await tx.taxRate.findMany({ select: { country: true, ratePercent: true, isDefault: true } })
    ).map((r) => ({ ...r, ratePercent: Number(r.ratePercent) }));

    for (const { row, grossCents } of valid) {
      // Plattform per Name auflösen (bei Bedarf anlegen)
      const platformName = row.plattform?.trim() || "Sonstiges";
      let platform = await tx.platform.findFirst({ where: { name: platformName } });
      if (!platform) {
        platform = await tx.platform.create({
          data: { organizationId, name: platformName },
        });
      }

      // LagerIDs auflösen (fehlende werden ignoriert – Alt-Daten)
      const skus = (row.lagerids ?? "")
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const stockItems = skus.length
        ? await tx.stockItem.findMany({ where: { sku: { in: skus } } })
        : [];

      const buyerCountry = (row.land?.trim().toUpperCase() || "DE").slice(0, 2);
      const taxRatePercent = resolveTaxRatePercent(taxRates, buyerCountry);
      const ekNetto =
        parseEuroTolerant(row.ek_netto) ??
        stockItems.reduce(
          (sum, i) =>
            sum +
            (i.purchaseNetCents ??
              calcPurchaseNetCents(i.purchasePriceCents, i.inputTaxDeductible, 19)),
          0
        );
      const feeGross = parseEuroTolerant(row.gebuehren_brutto) ?? 0;
      const feeNet = feeNetCents(feeGross, true);
      const shipping = parseEuroTolerant(row.versand) ?? 0;

      const calc = calcSale({
        saleGrossCents: grossCents,
        taxRatePercent,
        purchaseNetCents: ekNetto,
        shippingCostCents: shipping,
        platformFeeCents: feeNet,
        paymentFeeCents: 0,
      });

      const soldAt = parseDateFlexible(row.datum) ?? new Date();
      const invoiceDone = ["erledigt", "ja", "true", "x"].includes(
        (row.rechnung ?? "").trim().toLowerCase()
      );
      const completed = ["abgeschlossen", "erledigt"].includes(
        (row.status ?? "").trim().toLowerCase()
      );

      const sale = await tx.sale.create({
        data: {
          organizationId,
          platformId: platform.id,
          soldAt,
          quantity: Math.max(1, stockItems.length),
          salePriceCents: grossCents,
          saleNetCents: calc.saleNetCents,
          taxRatePercent,
          marginCents: calc.marginCents,
          profitCents: calc.profitCents,
          buyerCountry,
          shippingMethod: row.versandart?.trim() || null,
          shippingCostCents: shipping,
          platformFeeCents: feeGross,
          platformFeeNetCents: feeNet,
          payoutRecipient: row.auszahlung?.trim() || null,
          status: completed ? "COMPLETED" : "PENDING",
          invoiceCreated: invoiceDone,
          notes: [row.model?.trim(), row.kommentar?.trim()].filter(Boolean).join(" · ") || null,
          orderNumber: row.orderid?.trim() || null,
          items: {
            create: stockItems.map((item) => ({
              organizationId,
              stockItemId: item.id,
              ekNetCents:
                item.purchaseNetCents ??
                calcPurchaseNetCents(item.purchasePriceCents, item.inputTaxDeductible, 19),
            })),
          },
        },
      });
      void sale;

      if (stockItems.length > 0) {
        await tx.stockItem.updateMany({
          where: { id: { in: stockItems.map((i) => i.id) } },
          data: { status: "SOLD", quantity: 0 },
        });
      }
    }
  }, { timeout: 120000 });

  return valid.length;
}

// --- Retouren ----------------------------------------------------------------

async function importRetouren(
  rows: Row[],
  errors: Array<{ row: number; message: string }>,
  dryRun: boolean,
  organizationId: string
): Promise<number> {
  // Verkäufe per OrderID auflösen – fehlende sind Fehler
  const sales = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    return tx.sale.findMany({
      where: { orderNumber: { in: rows.map((r) => r.orderid?.trim()).filter(Boolean) } },
      select: {
        id: true,
        orderNumber: true,
        salePriceCents: true,
        taxRatePercent: true,
        platformFeeNetCents: true,
        shippingCostCents: true,
      },
    });
  });
  const byOrder = new Map(sales.map((s) => [s.orderNumber, s]));

  const prepared = rows
    .map((row, index) => {
      const sale = byOrder.get(row.orderid?.trim());
      if (!sale) {
        errors.push({
          row: index + 1,
          message: `Kein Verkauf mit OrderID "${row.orderid ?? ""}" gefunden.`,
        });
        return null;
      }
      const refund = parseEuroTolerant(row.erstattung) ?? 0;
      const extra = parseEuroTolerant(row.zusatzkosten) ?? 0;
      return { sale, refund, extra, row, rowIndex: index + 1 };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const errorRows = new Set(errors.map((e) => e.row));
  const valid = prepared.filter((r) => !errorRows.has(r.rowIndex));
  if (dryRun || valid.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    for (const { sale, refund, extra, row } of valid) {
      const lossCents = calcReturnLoss({
        refundGrossCents: refund,
        taxRatePercent: Number(sale.taxRatePercent),
        saleGrossCents: sale.salePriceCents,
        platformFeeCents: sale.platformFeeNetCents,
        paymentFeeCents: 0,
        shippingCostCents: sale.shippingCostCents,
        extraCostCents: extra,
      });
      await tx.return.create({
        data: {
          organizationId,
          saleId: sale.id,
          requestedAt: parseDateFlexible(row.datum) ?? new Date(),
          reason: row.grund?.trim() || null,
          refundAmountCents: refund,
          returnShippingCents: extra,
          lossCents,
          status: pick(row.status, RETURN_STATUS_MAP, "REQUESTED"),
          notes: row.kommentar?.trim() || null,
        },
      });
    }
  }, { timeout: 60000 });

  return valid.length;
}

// --- Konsignation --------------------------------------------------------------

async function importKonsignation(
  rows: Row[],
  errors: Array<{ row: number; message: string }>,
  dryRun: boolean,
  organizationId: string
): Promise<number> {
  const errorRows = new Set(errors.map((e) => e.row));
  const valid = rows.filter((_, index) => !errorRows.has(index + 1));
  if (dryRun || valid.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    for (const row of valid) {
      const sku =
        row.sku?.trim() ||
        `K-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296)
          .toString(36)
          .toUpperCase()}`;
      await tx.consignmentInventory.upsert({
        where: { organizationId_sku: { organizationId, sku } },
        create: {
          organizationId,
          sku,
          consignorName: row.partner.trim(),
          itemTitle: row.artikel.trim(),
          quantity: Number(row.bestand) || 0,
          soldQuantity: Number(row.verkauft) || 0,
          returnedQuantity: Number(row.retourniert) || 0,
          defectiveQuantity: Number(row.defekt) || 0,
          notes: row.kommentar?.trim() || null,
        },
        update: {
          consignorName: row.partner.trim(),
          itemTitle: row.artikel.trim(),
          quantity: Number(row.bestand) || 0,
          soldQuantity: Number(row.verkauft) || 0,
          returnedQuantity: Number(row.retourniert) || 0,
          defectiveQuantity: Number(row.defekt) || 0,
        },
      });
    }
  }, { timeout: 60000 });

  return valid.length;
}

// --- Schulden ------------------------------------------------------------------

async function importSchulden(
  rows: Row[],
  errors: Array<{ row: number; message: string }>,
  dryRun: boolean,
  organizationId: string
): Promise<number> {
  const prepared = rows
    .map((row, index) => {
      const amount = parseEuroTolerant(row.betrag);
      if (amount === null || amount <= 0) {
        errors.push({ row: index + 1, message: `Ungültiger Betrag: "${row.betrag ?? ""}"` });
        return null;
      }
      return { row, amount, rowIndex: index + 1 };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const errorRows = new Set(errors.map((e) => e.row));
  const valid = prepared.filter((r) => !errorRows.has(r.rowIndex));
  if (dryRun || valid.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    await tx.debt.createMany({
      data: valid.map(({ row, amount }) => {
        const status = pick(row.status, DEBT_STATUS_MAP, "OPEN");
        return {
          organizationId,
          debtDate: parseDateFlexible(row.datum) ?? new Date(),
          refId: row.refid?.trim() || null,
          description: row.beschreibung.trim(),
          kind: pick(row.art, DEBT_KIND_MAP, "SONSTIGES"),
          quantity: Number(row.menge) || 1,
          amountCents: amount,
          paidCents: status === "SETTLED" ? amount : 0,
          debtorName: row.schuldner.trim(),
          creditorName: row.empfaenger.trim(),
          status,
          entryStatus: pick(row.eintrag, DEBT_ENTRY_MAP, "IO"),
          settledAt: status === "SETTLED" ? parseDateFlexible(row.beglichen) ?? new Date() : null,
          notes: row.kommentar?.trim() || null,
        };
      }),
    });
  }, { timeout: 60000 });

  return valid.length;
}

// --- Aufgaben ---------------------------------------------------------------------

async function importAufgaben(
  rows: Row[],
  errors: Array<{ row: number; message: string }>,
  dryRun: boolean,
  organizationId: string,
  createdById: string
): Promise<number> {
  const errorRows = new Set(errors.map((e) => e.row));
  const valid = rows.filter((_, index) => !errorRows.has(index + 1));
  if (dryRun || valid.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
    const members = await tx.membership.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await tx.task.createMany({
      data: valid.map((row) => {
        const who = row.zustaendig?.trim().toLowerCase();
        const assignee =
          who && who !== "alle"
            ? members.find(
                (m) =>
                  m.user.name?.toLowerCase() === who ||
                  m.user.email.toLowerCase() === who
              )
            : undefined;
        const status = pick(row.status, TASK_STATUS_MAP, "OPEN");
        return {
          organizationId,
          title: row.aufgabe.trim(),
          description: row.anmerkung?.trim() || null,
          area: row.bereich?.trim() || null,
          priority: pick(row.prioritaet, TASK_PRIO_MAP, "MEDIUM"),
          status,
          archived: status === "DONE",
          dueDate: parseDateFlexible(row.frist),
          assigneeId: assignee?.userId ?? null,
          createdById,
        };
      }),
    });
  }, { timeout: 60000 });

  return valid.length;
}
