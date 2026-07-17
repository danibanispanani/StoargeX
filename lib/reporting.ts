import type { TenantDb } from "@/lib/tenant-db";

// Aggregationen fürs Dashboard-Cockpit – direkt aus Sale/Return/Task/StockItem
// (ersetzt die manuellen SUMIFS-Auswertungen der Excel-Lösung).

/** Gruppierungszeile (von der Breakdown-Tabelle weiterverwendet). */
export interface GroupRow {
  key: string;
  salesCount: number;
  revenueCents: number;
  profitCents: number;
  feesCents: number;
}

// ---------------------------------------------------------------------------
// Zeitraum: dieses Jahr / letztes Jahr / benutzerdefiniert
// ---------------------------------------------------------------------------

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

/** Löst den Zeitraum-Filter des Dashboards auf. */
export function resolvePeriod(
  jahr: string | undefined,
  von: string | undefined,
  bis: string | undefined
): DateRange {
  const now = new Date();
  const currentYear = now.getFullYear();

  if (jahr === "benutzerdefiniert" && (von || bis)) {
    const from = von ? new Date(`${von}T00:00:00`) : new Date(currentYear, 0, 1);
    const to = bis ? new Date(`${bis}T23:59:59`) : now;
    return {
      from,
      to,
      label: `${from.toLocaleDateString("de-DE")} – ${to.toLocaleDateString("de-DE")}`,
    };
  }

  const year = jahr === "letztes-jahr" ? currentYear - 1 : currentYear;
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31, 23, 59, 59),
    label: String(year),
  };
}

function rangeWhere(range: DateRange) {
  return { gte: range.from, lte: range.to };
}

// ---------------------------------------------------------------------------
// KPI-Karten
// ---------------------------------------------------------------------------

export interface DashboardKpis {
  salesCount: number;
  revenueCents: number; // VK brutto
  profitCents: number;
  openReturnsCount: number;
  customerReturnLossCents: number;
  supplierReturnDeadlinesCount: number;
  openSupplierRefundsCount: number;
  supplierReturnBoundCapitalCents: number;
  stockInStockCount: number; // Artikel auf Lager
  consignmentStockCount: number;
  stockValueCents: number;
  stockInTransitCount: number; // unterwegs
  openInvoicesCount: number; // Verkäufe mit Rechnung = Offen
  dueTasksCount: number; // Frist heute oder überschritten
}

const STOCK_ON_HAND = ["IN_STOCK", "STORED_R", "STORED_D", "LISTED", "RESERVED", "RETURNED"] as const;

export async function loadDashboardKpis(
  db: TenantDb,
  range: DateRange
): Promise<DashboardKpis> {
  const soldAt = rangeWhere(range);

  const [
    sales,
    openReturns,
    customerReturnLoss,
    supplierReturnDeadlines,
    openSupplierRefunds,
    supplierReturnCapitalLines,
    inventoryStock,
    ownedInventory,
    legacyInStock,
    legacyInTransit,
    openInvoices,
    dueTasks,
  ] =
    await Promise.all([
      db.sale.aggregate({
        where: { soldAt },
        _count: true,
        _sum: { salePriceCents: true, profitCents: true },
      }),
      db.return.count({
        where: {
          requestedAt: soldAt,
          status: { in: ["REQUESTED", "RECEIVED", "INSPECTION", "DEFECTIVE", "CONFLICT"] },
        },
      }),
      db.return.aggregate({
        where: { requestedAt: soldAt },
        _sum: { lossCents: true },
      }),
      db.supplierReturn.count({
        where: {
          returnDeadline: { not: null, lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
          status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] },
        },
      }),
      db.supplierReturn.count({
        where: {
          status: { in: ["DISPATCHED", "ARRIVED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "CREDIT_PENDING"] },
        },
      }),
      db.supplierReturnLine.findMany({
        where: { supplierReturn: { status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] } } },
        select: { quantity: true, purchaseLine: { select: { unitPriceNet: true } } },
      }),
      db.inventoryPosition.aggregate({
        where: { active: true },
        _sum: { quantityAvailable: true },
      }),
      db.inventoryPosition.findMany({
        where: { active: true, inventoryType: "OWNED" },
        select: {
          quantityAvailable: true,
          ownedLot: { select: { unitPriceNet: true } },
        },
      }),
      db.stockItem.count({ where: { status: { in: [...STOCK_ON_HAND] } } }),
      db.stockItem.count({ where: { status: "IN_TRANSIT" } }),
      db.sale.count({ where: { soldAt, invoiceCreated: false } }),
      db.task.count({
        where: {
          archived: false,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          dueDate: { lte: new Date() },
        },
      }),
    ]);

  return {
    salesCount: sales._count,
    revenueCents: sales._sum.salePriceCents ?? 0,
    profitCents: sales._sum.profitCents ?? 0,
    openReturnsCount: openReturns,
    customerReturnLossCents: customerReturnLoss._sum.lossCents ?? 0,
    supplierReturnDeadlinesCount: supplierReturnDeadlines,
    openSupplierRefundsCount: openSupplierRefunds,
    supplierReturnBoundCapitalCents: supplierReturnCapitalLines.reduce(
      (sum, line) => sum + line.quantity * Math.round(Number(line.purchaseLine.unitPriceNet) * 100),
      0
    ),
    stockInStockCount: (inventoryStock._sum.quantityAvailable ?? 0) + legacyInStock,
    consignmentStockCount:
      (await db.inventoryPosition.aggregate({
        where: { active: true, inventoryType: "CONSIGNMENT" },
        _sum: { quantityAvailable: true },
      }))._sum.quantityAvailable ?? 0,
    stockValueCents: ownedInventory.reduce(
      (sum, position) =>
        sum +
        position.quantityAvailable *
          Math.round(Number(position.ownedLot?.unitPriceNet ?? 0) * 100),
      0
    ),
    stockInTransitCount: legacyInTransit,
    openInvoicesCount: openInvoices,
    dueTasksCount: dueTasks,
  };
}

// ---------------------------------------------------------------------------
// Schulden-Saldo pro Person (nur offene Einträge mit GbR-Bezug)
// ---------------------------------------------------------------------------

export interface DebtBalance {
  person: string;
  /** > 0: GbR schuldet der Person; < 0: Person schuldet der GbR */
  netCents: number;
}

export async function loadDebtBalances(db: TenantDb): Promise<DebtBalance[]> {
  const debts = await db.debt.findMany({
    where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } },
    select: {
      debtorName: true,
      creditorName: true,
      amountCents: true,
      paidCents: true,
    },
  });

  const balances = new Map<string, number>();
  for (const d of debts) {
    const open = d.amountCents - d.paidCents;
    const debtor = d.debtorName.trim();
    const creditor = d.creditorName.trim();
    if (debtor.toLowerCase() === "gbr" && creditor.toLowerCase() !== "gbr") {
      balances.set(creditor, (balances.get(creditor) ?? 0) + open);
    } else if (creditor.toLowerCase() === "gbr" && debtor.toLowerCase() !== "gbr") {
      balances.set(debtor, (balances.get(debtor) ?? 0) - open);
    }
  }

  return [...balances.entries()]
    .filter(([, net]) => net !== 0)
    .map(([person, netCents]) => ({ person, netCents }))
    .sort((a, b) => Math.abs(b.netCents) - Math.abs(a.netCents));
}

// ---------------------------------------------------------------------------
// Diagramm-Daten
// ---------------------------------------------------------------------------

/** a) Quartalsvergleich: Umsatz aktuelles vs. letztes Jahr. */
export interface QuarterRow {
  quartal: string; // "Q1"…
  aktuell: number; // Euro
  vorjahr: number;
}

export async function loadQuarterlyComparison(
  db: TenantDb,
  year: number
): Promise<{ rows: QuarterRow[]; currentYear: number; lastYear: number }> {
  const from = new Date(year - 1, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);
  const sales = await db.sale.findMany({
    where: { soldAt: { gte: from, lte: to } },
    select: { soldAt: true, salePriceCents: true },
  });

  const buckets = {
    [year]: [0, 0, 0, 0],
    [year - 1]: [0, 0, 0, 0],
  } as Record<number, number[]>;

  for (const s of sales) {
    const y = s.soldAt.getFullYear();
    if (!buckets[y]) continue;
    const q = Math.floor(s.soldAt.getMonth() / 3);
    buckets[y][q] += s.salePriceCents;
  }

  const rows: QuarterRow[] = [0, 1, 2, 3].map((q) => ({
    quartal: `Q${q + 1}`,
    aktuell: Math.round((buckets[year][q] ?? 0) / 100),
    vorjahr: Math.round((buckets[year - 1][q] ?? 0) / 100),
  }));

  return { rows, currentYear: year, lastYear: year - 1 };
}

/** b) Einkauf (EK brutto) vs. Verkauf (VK brutto) pro Monat. */
export interface MonthFlowRow {
  monat: string; // "2026-01"
  label: string; // "Jan 26"
  einkauf: number; // Euro
  verkauf: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function lowStockKey(title: string, variant: string | null | undefined) {
  return `${title.trim()}::${(variant ?? "").trim()}`;
}

export async function loadPurchaseVsSaleMonthly(
  db: TenantDb,
  range: DateRange
): Promise<MonthFlowRow[]> {
  const [legacyPurchases, inventoryPurchases, sales] = await Promise.all([
    db.stockItem.findMany({
      where: { purchaseDate: rangeWhere(range) },
      select: { purchaseDate: true, purchasePriceCents: true },
    }),
    db.inventoryPosition.findMany({
      where: {
        inventoryType: "OWNED",
        receivedAt: rangeWhere(range),
      },
      select: {
        receivedAt: true,
        quantityReceived: true,
        ownedLot: { select: { unitPriceGross: true } },
      },
    }),
    db.sale.findMany({
      where: { soldAt: rangeWhere(range) },
      select: { soldAt: true, salePriceCents: true },
    }),
  ]);

  const map = new Map<string, MonthFlowRow>();
  const ensure = (d: Date) => {
    const k = monthKey(d);
    let row = map.get(k);
    if (!row) {
      row = { monat: k, label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`, einkauf: 0, verkauf: 0 };
      map.set(k, row);
    }
    return row;
  };

  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
  const end = new Date(range.to.getFullYear(), range.to.getMonth(), 1);
  while (cursor <= end) {
    ensure(cursor);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const p of legacyPurchases) {
    if (p.purchaseDate) ensure(p.purchaseDate).einkauf += p.purchasePriceCents;
  }
  for (const p of inventoryPurchases) {
    ensure(p.receivedAt).einkauf +=
      p.quantityReceived * Math.round(Number(p.ownedLot?.unitPriceGross ?? 0) * 100);
  }
  for (const s of sales) ensure(s.soldAt).verkauf += s.salePriceCents;

  return [...map.values()]
    .sort((a, b) => a.monat.localeCompare(b.monat))
    .map((r) => ({ ...r, einkauf: Math.round(r.einkauf / 100), verkauf: Math.round(r.verkauf / 100) }));
}

/** c) Kreisdiagramm: Umsatzanteil je Plattform. */
export interface PlatformSlice {
  name: string;
  value: number; // Euro
}

export async function loadPlatformShare(
  db: TenantDb,
  range: DateRange
): Promise<PlatformSlice[]> {
  const sales = await db.sale.findMany({
    where: { soldAt: rangeWhere(range) },
    select: { salePriceCents: true, platform: { select: { name: true } } },
  });

  const map = new Map<string, number>();
  for (const s of sales) {
    const bucket = normalizePlatformBucket(s.platform.name);
    map.set(bucket, (map.get(bucket) ?? 0) + s.salePriceCents);
  }
  return ["eBay R", "eBay D", "Vinted", "KA", "StockX", "Sonstiges"]
    .map((name) => ({ name, value: Math.round((map.get(name) ?? 0) / 100) }))
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
}

function normalizePlatformBucket(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (normalized === "ebay r" || normalized.includes("ebay r")) return "eBay R";
  if (normalized === "ebay d" || normalized.includes("ebay d")) return "eBay D";
  if (normalized.includes("vinted")) return "Vinted";
  if (normalized === "ka" || normalized.includes("kleinanzeigen")) return "KA";
  if (normalized.includes("stockx")) return "StockX";
  return "Sonstiges";
}

/** d) Top 10 Modelle nach kumuliertem Gewinn. */
export interface TopProductRow {
  model: string;
  profit: number; // Euro
  salesCount: number;
}

export async function loadTopProducts(
  db: TenantDb,
  range: DateRange
): Promise<TopProductRow[]> {
  const sales = await db.sale.findMany({
    where: { soldAt: rangeWhere(range) },
    select: {
      profitCents: true,
      saleLines: {
        select: {
          descriptionSnapshot: true,
        },
      },
      items: {
        select: {
          stockItem: { select: { title: true } },
          consignment: { select: { itemTitle: true } },
        },
      },
    },
  });

  const map = new Map<string, { profit: number; count: number }>();
  for (const s of sales) {
    // Gewinn dem/den Modell(en) des Verkaufs zuordnen (bei Mehrartikel geteilt)
    const lineModels = s.saleLines.map((line) => line.descriptionSnapshot);
    const legacyModels = s.items
      .map((i) => i.stockItem?.title ?? i.consignment?.itemTitle)
      .filter((m): m is string => Boolean(m));
    const models = [...new Set(lineModels.length > 0 ? lineModels : legacyModels)];
    if (models.length === 0) continue;
    const share = s.profitCents / models.length;
    for (const model of models) {
      const entry = map.get(model) ?? { profit: 0, count: 0 };
      entry.profit += share;
      entry.count += 1;
      map.set(model, entry);
    }
  }

  return [...map.entries()]
    .map(([model, v]) => ({ model, profit: Math.round(v.profit / 100), salesCount: v.count }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Kompakt-Tabellen
// ---------------------------------------------------------------------------

export async function loadRecentSales(db: TenantDb) {
  return db.sale.findMany({
    include: {
      platform: { select: { name: true } },
      saleLines: {
        select: {
          descriptionSnapshot: true,
        },
      },
      items: {
        select: {
          stockItem: { select: { title: true } },
          consignment: { select: { itemTitle: true } },
        },
      },
    },
    orderBy: { soldAt: "desc" },
    take: 10,
  });
}

export async function loadOpenDebts(db: TenantDb) {
  return db.debt.findMany({
    where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } },
    orderBy: { debtDate: "desc" },
    take: 10,
  });
}

// ---------------------------------------------------------------------------
// Niedrig-Bestand-Warnung (OOS)
// ---------------------------------------------------------------------------

export interface LowStockAlert {
  key: string; // "title variant" (für Zeilen-Markierung im Lager)
  model: string;
  onHand: number;
  total: number;
}

/**
 * Gruppiert Lagerartikel nach Modell+Variante. Warnung, wenn ursprünglich
 * mehr als 1 Einheit vorhanden war und die nicht verkaufte Restmenge auf den
 * Schwellenwert oder darunter (aber > 0) gesunken ist.
 */
export async function loadLowStockAlerts(
  db: TenantDb,
  threshold: number
): Promise<LowStockAlert[]> {
  const [items, positions] = await Promise.all([
    db.stockItem.findMany({
      select: { title: true, variant: true, status: true },
    }),
    db.inventoryPosition.findMany({
      where: { active: true, inventoryType: "OWNED" },
      select: {
        quantityAvailable: true,
        quantityReceived: true,
        product: { select: { name: true, variant: true } },
      },
    }),
  ]);

  const groups = new Map<string, { key: string; model: string; onHand: number; total: number }>();
  for (const position of positions) {
    const key = lowStockKey(position.product.name, position.product.variant);
    const g = groups.get(key) ?? {
      key,
      model: position.product.variant
        ? `${position.product.name} (${position.product.variant})`
        : position.product.name,
      onHand: 0,
      total: 0,
    };
    g.total += position.quantityReceived;
    g.onHand += position.quantityAvailable;
    groups.set(key, g);
  }
  for (const item of items) {
    const key = lowStockKey(item.title, item.variant);
    const g = groups.get(key) ?? {
      key,
      model: item.variant ? `${item.title} (${item.variant})` : item.title,
      onHand: 0,
      total: 0,
    };
    g.total += 1;
    if (!["SOLD", "CANCELLED", "WRITTEN_OFF"].includes(item.status)) g.onHand += 1;
    groups.set(key, g);
  }

  return [...groups.values()]
    .filter((g) => g.total > 1 && g.onHand > 0 && g.onHand <= threshold)
    .sort((a, b) => a.onHand - b.onHand);
}
