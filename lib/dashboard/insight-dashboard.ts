export type InsightPeriodPreset =
  | "7-tage"
  | "30-tage"
  | "dieses-jahr"
  | "letztes-jahr"
  | "benutzerdefiniert";

export type InsightOwnership = "ALL" | "OWNED" | "CONSIGNMENT";

export interface InsightFilterInput {
  zeitraum?: string;
  von?: string;
  bis?: string;
  platform?: string;
  account?: string;
  category?: string;
  ownership?: string;
  member?: string;
}

export interface InsightFilters {
  zeitraum: InsightPeriodPreset;
  von: string;
  bis: string;
  platformId: string;
  marketplaceAccountId: string;
  category: string;
  ownership: InsightOwnership;
  memberId: string;
}

export interface InsightDateRange {
  from: Date;
  to: Date;
  label: string;
}

export interface InsightPeriod {
  current: InsightDateRange;
  previous: InsightDateRange;
}

export interface InsightSale {
  id: string;
  soldAt: Date;
  revenueCents: number;
  profitCents: number;
  platformFeeCents: number;
  shippingCostCents: number;
  status: string;
  invoiceCreated: boolean;
  postageBooked: boolean;
  feesBooked: boolean;
  productLabels: string[];
}

export interface InsightInventoryPosition {
  id: string;
  productLabel: string;
  inventoryType: "OWNED" | "CONSIGNMENT";
  receivedAt: Date;
  available: number;
  received: number;
  reserved: number;
  inspection: number;
  defective: number;
  unitCostCents: number;
}

export interface InsightCustomerReturn {
  id: string;
  requestedAt: Date;
  lossCents: number;
  open: boolean;
}

export interface InsightSupplierReturn {
  id: string;
  returnDeadline: Date | null;
  refundExpectedAt: Date | null;
  expectedRefundCents: number;
  actualRefundCents: number;
  boundCapitalCents: number;
  open: boolean;
  refundOpen: boolean;
}

export interface InsightExpense {
  id: string;
  incurredAt: Date;
  amountGrossCents: number;
  recurring: boolean;
}

export interface InsightDebt {
  id: string;
  openCents: number;
  dueDate: Date | null;
}

export interface InsightTask {
  id: string;
  status: string;
  dueDate: Date | null;
  assigneeLabels: string[];
  createdAt: Date;
  completedAt: Date | null;
  blocker: boolean;
}

export interface InsightPurchaseDeadline {
  id: string;
  deadline: Date;
}

export interface InsightSourceData {
  now: Date;
  lowStockThreshold: number;
  sales: InsightSale[];
  inventory: InsightInventoryPosition[];
  customerReturns: InsightCustomerReturn[];
  supplierReturns: InsightSupplierReturn[];
  expenses: InsightExpense[];
  debts: InsightDebt[];
  tasks: InsightTask[];
  purchaseDeadlines: InsightPurchaseDeadline[];
  importConflicts: number;
}

export type InsightTone = "critical" | "warning" | "neutral";

export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  detail: string;
  href: string;
  tone: InsightTone;
  priority: number;
}

export interface InsightSnapshot {
  trade: {
    revenueCents: number;
    profitCents: number;
    salesCount: number;
    marginPercent: number;
    revenueChangePercent: number | null;
    profitChangePercent: number | null;
    salesChangePercent: number | null;
    trend7: Array<{ date: string; revenueCents: number; profitCents: number }>;
    trend30: Array<{ date: string; revenueCents: number; profitCents: number }>;
  };
  inventory: {
    available: number;
    reserved: number;
    inspection: number;
    defective: number;
    lowStockProducts: number;
    slowStockUnits: number;
    boundCapitalCents: number;
    ownedUnits: number;
    consignmentUnits: number;
  };
  margin: {
    feeLoadPercent: number;
    shippingLoadPercent: number;
    belowTargetCount: number;
    distribution: Array<{ label: string; count: number }>;
    strongestProducts: Array<{ label: string; profitCents: number }>;
    weakestProducts: Array<{ label: string; profitCents: number }>;
  };
  returns: {
    customer: {
      count: number;
      ratePercent: number;
      lossCents: number;
      openCount: number;
    };
    supplier: {
      openCount: number;
      deadlineCount: number;
      openRefundCents: number;
      boundCapitalCents: number;
    };
  };
  cash: {
    openDebtCents: number;
    expectedPayoutCents: number;
    oneTimeExpenseCents: number;
    recurringExpenseCents: number;
    profitBeforeExpensesCents: number;
    profitAfterExpensesCents: number;
    cashRecoveryPercent: number | null;
  };
  team: {
    openCount: number;
    overdueCount: number;
    blockerCount: number;
    averageCycleDays: number | null;
    byMember: Array<{ label: string; openCount: number }>;
  };
  attention: AttentionItem[];
}

const PERIODS = new Set<InsightPeriodPreset>([
  "7-tage",
  "30-tage",
  "dieses-jahr",
  "letztes-jahr",
  "benutzerdefiniert",
]);

const OWNERSHIP = new Set<InsightOwnership>(["ALL", "OWNED", "CONSIGNMENT"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_TASK_STATUSES = new Set(["OPEN", "IN_PROGRESS"]);

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

export function parseInsightFilters(input: InsightFilterInput): InsightFilters {
  const period = clean(input.zeitraum) as InsightPeriodPreset;
  const ownership = clean(input.ownership) as InsightOwnership;
  return {
    zeitraum: PERIODS.has(period) ? period : "30-tage",
    von: validDateInput(input.von) ? input.von! : "",
    bis: validDateInput(input.bis) ? input.bis! : "",
    platformId: clean(input.platform),
    marketplaceAccountId: clean(input.account),
    category: clean(input.category),
    ownership: OWNERSHIP.has(ownership) ? ownership : "ALL",
    memberId: clean(input.member),
  };
}

function validDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function utcStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcEnd(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
}

function shiftDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function customDate(value: string, end: boolean) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0));
}

export function resolveInsightPeriod(
  input: Pick<InsightFilterInput, "zeitraum" | "von" | "bis">,
  now = new Date()
): InsightPeriod {
  const filters = parseInsightFilters(input);
  const todayStart = utcStart(now);
  const todayEnd = utcEnd(now);
  let from: Date;
  let to: Date;
  let label: string;

  if (filters.zeitraum === "7-tage") {
    from = shiftDays(todayStart, -6);
    to = todayEnd;
    label = "Letzte 7 Tage";
  } else if (filters.zeitraum === "30-tage") {
    from = shiftDays(todayStart, -29);
    to = todayEnd;
    label = "Letzte 30 Tage";
  } else if (filters.zeitraum === "benutzerdefiniert" && (filters.von || filters.bis)) {
    from = filters.von
      ? customDate(filters.von, false)
      : new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    to = filters.bis ? customDate(filters.bis, true) : todayEnd;
    if (from > to) [from, to] = [utcStart(to), utcEnd(from)];
    label = `${from.toLocaleDateString("de-DE", { timeZone: "UTC" })} – ${to.toLocaleDateString("de-DE", { timeZone: "UTC" })}`;
  } else {
    const year =
      filters.zeitraum === "letztes-jahr" ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    from = new Date(Date.UTC(year, 0, 1));
    to =
      year === now.getUTCFullYear()
        ? todayEnd
        : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    label = filters.zeitraum === "letztes-jahr" ? `Vorjahr ${year}` : `Dieses Jahr ${year}`;
  }

  const duration = to.getTime() - from.getTime() + 1;
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration + 1);
  return {
    current: { from, to, label },
    previous: {
      from: previousFrom,
      to: previousTo,
      label: "Vergleichszeitraum",
    },
  };
}

function inRange(date: Date, range: InsightDateRange) {
  const time = date.getTime();
  return time >= range.from.getTime() && time <= range.to.getTime();
}

function sum<T>(values: T[], select: (value: T) => number) {
  return values.reduce((total, value) => total + select(value), 0);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function ratioPercent(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : roundOne((numerator / denominator) * 100);
}

function comparisonPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return roundOne(((current - previous) / Math.abs(previous)) * 100);
}

function trend(
  sales: InsightSale[],
  to: Date,
  days: number
): Array<{ date: string; revenueCents: number; profitCents: number }> {
  const start = shiftDays(utcStart(to), -(days - 1));
  const rows = new Map<string, { date: string; revenueCents: number; profitCents: number }>();
  for (let index = 0; index < days; index += 1) {
    const date = shiftDays(start, index).toISOString().slice(0, 10);
    rows.set(date, { date, revenueCents: 0, profitCents: 0 });
  }
  for (const sale of sales) {
    const key = sale.soldAt.toISOString().slice(0, 10);
    const row = rows.get(key);
    if (row) {
      row.revenueCents += sale.revenueCents;
      row.profitCents += sale.profitCents;
    }
  }
  return [...rows.values()];
}

function marginDistribution(sales: InsightSale[]) {
  const buckets = [
    { label: "< 0 %", count: 0 },
    { label: "0–10 %", count: 0 },
    { label: "10–20 %", count: 0 },
    { label: "≥ 20 %", count: 0 },
  ];
  for (const sale of sales) {
    const margin = ratioPercent(sale.profitCents, sale.revenueCents);
    if (margin < 0) buckets[0].count += 1;
    else if (margin < 10) buckets[1].count += 1;
    else if (margin < 20) buckets[2].count += 1;
    else buckets[3].count += 1;
  }
  return buckets;
}

function productRanking(sales: InsightSale[]) {
  const products = new Map<string, number>();
  for (const sale of sales) {
    const labels = [...new Set(sale.productLabels.filter(Boolean))];
    if (labels.length === 0) continue;
    const share = sale.profitCents / labels.length;
    for (const label of labels) products.set(label, (products.get(label) ?? 0) + share);
  }
  return [...products.entries()].map(([label, profitCents]) => ({
    label,
    profitCents: Math.round(profitCents),
  }));
}

function buildAttention(input: {
  overdueTasks: number;
  supplierDeadlines: number;
  openSupplierRefunds: number;
  lowStockProducts: number;
  missingBookings: number;
  shippingActions: number;
  openDebts: number;
  purchaseDeadlines: number;
  importConflicts: number;
  saleDateQuery: string;
}) {
  const candidates: Array<AttentionItem | null> = [
    input.overdueTasks
      ? {
          key: "overdue-tasks",
          label: "Überfällige Aufgaben",
          count: input.overdueTasks,
          detail: "Frist überschritten · Verantwortliche und nächste Schritte prüfen",
          href: "/aufgaben?view=faellig",
          tone: "critical",
          priority: 10,
        }
      : null,
    input.supplierDeadlines
      ? {
          key: "supplier-return-deadlines",
          label: "Lieferantenretouren vor Fristablauf",
          count: input.supplierDeadlines,
          detail: "Frist in höchstens 14 Tagen · keine automatische Rückgabe",
          href: "/retouren/lieferanten?preset=deadlines",
          tone: "critical",
          priority: 20,
        }
      : null,
    input.openSupplierRefunds
      ? {
          key: "supplier-refunds",
          label: "Offene Lieferantenerstattungen",
          count: input.openSupplierRefunds,
          detail: "Erwartete und tatsächliche Erstattung abgleichen",
          href: "/retouren/lieferanten?preset=refund",
          tone: "warning",
          priority: 30,
        }
      : null,
    input.lowStockProducts
      ? {
          key: "low-stock",
          label: "Niedriger Bestand",
          count: input.lowStockProducts,
          detail: "Verfügbare Menge liegt am konfigurierten Schwellenwert",
          href: "/produkte?preset=low-stock",
          tone: "warning",
          priority: 40,
        }
      : null,
    input.missingBookings
      ? {
          key: "missing-sale-bookings",
          label: "Verkäufe mit fehlenden Buchungen",
          count: input.missingBookings,
          detail: "Rechnung oder Gebührenbuchung ist noch offen",
          href: `/verkauf?preset=finances&buchung=fehlt${input.saleDateQuery}`,
          tone: "warning",
          priority: 50,
        }
      : null,
    input.openDebts
      ? {
          key: "open-debts",
          label: "Offene Schulden",
          count: input.openDebts,
          detail: "Offene oder teilweise beglichene Salden",
          href: "/schulden?preset=due",
          tone: "warning",
          priority: 60,
        }
      : null,
    input.importConflicts
      ? {
          key: "import-conflicts",
          label: "Importkonflikte",
          count: input.importConflicts,
          detail: "Zeilen mit Konflikt oder Review-Bedarf prüfen",
          href: "/importe?status=konflikt",
          tone: "warning",
          priority: 70,
        }
      : null,
    input.shippingActions
      ? {
          key: "shipping-actions",
          label: "Ausstehende Versandaktionen",
          count: input.shippingActions,
          detail: "Bezahlte Verkäufe ohne gebuchtes Porto",
          href: `/verkauf?preset=shipping&porto=offen${input.saleDateQuery}`,
          tone: "warning",
          priority: 80,
        }
      : null,
    input.purchaseDeadlines
      ? {
          key: "purchase-deadlines",
          label: "Einkäufe vor Rückgabefrist",
          count: input.purchaseDeadlines,
          detail: "Wareneingang prüfen und Rückgabe bewusst bestätigen",
          href: "/einkauf?preset=deadlines",
          tone: "neutral",
          priority: 90,
        }
      : null,
  ];
  return candidates
    .filter((item): item is AttentionItem => item !== null)
    .sort((a, b) => a.priority - b.priority);
}

export function buildInsightSnapshot(
  source: InsightSourceData,
  period: InsightPeriod
): InsightSnapshot {
  const currentSales = source.sales.filter((sale) => inRange(sale.soldAt, period.current));
  const previousSales = source.sales.filter((sale) => inRange(sale.soldAt, period.previous));
  const revenueCents = sum(currentSales, (sale) => sale.revenueCents);
  const profitCents = sum(currentSales, (sale) => sale.profitCents);
  const previousRevenue = sum(previousSales, (sale) => sale.revenueCents);
  const previousProfit = sum(previousSales, (sale) => sale.profitCents);

  const inventoryGroups = new Map<string, { available: number; received: number }>();
  for (const position of source.inventory) {
    const group = inventoryGroups.get(position.productLabel) ?? { available: 0, received: 0 };
    group.available += position.available;
    group.received += position.received;
    inventoryGroups.set(position.productLabel, group);
  }
  const lowStockProducts = [...inventoryGroups.values()].filter(
    (group) =>
      group.received > 1 &&
      group.available > 0 &&
      group.available <= source.lowStockThreshold
  ).length;
  const slowCutoff = shiftDays(utcStart(source.now), -90);
  const slowStockUnits = sum(
    source.inventory.filter(
      (position) => position.available > 0 && position.receivedAt < slowCutoff
    ),
    (position) => position.available
  );

  const customerReturns = source.customerReturns.filter((item) =>
    inRange(item.requestedAt, period.current)
  );
  const todayStart = utcStart(source.now);
  const deadlineCutoff = shiftDays(utcEnd(source.now), 14);
  const supplierDeadlines = source.supplierReturns.filter(
    (item) =>
      item.open &&
      item.returnDeadline !== null &&
      item.returnDeadline >= todayStart &&
      item.returnDeadline <= deadlineCutoff
  );
  const openSupplierReturns = source.supplierReturns.filter((item) => item.open);
  const openSupplierRefunds = source.supplierReturns.filter((item) => item.refundOpen);
  const currentExpenses = source.expenses.filter((item) =>
    inRange(item.incurredAt, period.current)
  );
  const oneTimeExpenseCents = sum(
    currentExpenses.filter((item) => !item.recurring),
    (item) => item.amountGrossCents
  );
  const recurringExpenseCents = sum(
    currentExpenses.filter((item) => item.recurring),
    (item) => item.amountGrossCents
  );
  const expenseCents = oneTimeExpenseCents + recurringExpenseCents;
  const openDebts = source.debts.filter((debt) => debt.openCents > 0);
  const openDebtCents = sum(openDebts, (debt) => debt.openCents);
  const expectedPayoutCents = sum(
    currentSales.filter((sale) => ["PENDING", "PAID", "SHIPPED"].includes(sale.status)),
    (sale) => Math.max(0, sale.revenueCents - sale.platformFeeCents)
  );
  const completedTasks = source.tasks.filter((task) => task.completedAt !== null);
  const openTasks = source.tasks.filter((task) => OPEN_TASK_STATUSES.has(task.status));
  const overdueTasks = openTasks.filter(
    (task) => task.dueDate !== null && task.dueDate < utcStart(source.now)
  );
  const averageCycleDays =
    completedTasks.length === 0
      ? null
      : roundOne(
          sum(
            completedTasks,
            (task) => (task.completedAt!.getTime() - task.createdAt.getTime()) / DAY_MS
          ) / completedTasks.length
        );
  const byMember = new Map<string, number>();
  for (const task of openTasks) {
    const labels = task.assigneeLabels.length > 0 ? task.assigneeLabels : ["Nicht zugewiesen"];
    for (const label of labels) byMember.set(label, (byMember.get(label) ?? 0) + 1);
  }
  const rankings = productRanking(currentSales);
  const missingBookings = currentSales.filter(
    (sale) => !sale.invoiceCreated || !sale.feesBooked
  ).length;
  const shippingActions = currentSales.filter(
    (sale) => ["PAID", "SHIPPED"].includes(sale.status) && !sale.postageBooked
  ).length;
  const openRefundCents = sum(
    openSupplierRefunds,
    (item) => Math.max(0, item.expectedRefundCents - item.actualRefundCents)
  );
  const expectedSupplierRecovery = sum(
    source.supplierReturns,
    (item) => item.expectedRefundCents
  );
  const actualSupplierRecovery = sum(
    source.supplierReturns,
    (item) => item.actualRefundCents
  );

  return {
    trade: {
      revenueCents,
      profitCents,
      salesCount: currentSales.length,
      marginPercent: ratioPercent(profitCents, revenueCents),
      revenueChangePercent: comparisonPercent(revenueCents, previousRevenue),
      profitChangePercent: comparisonPercent(profitCents, previousProfit),
      salesChangePercent: comparisonPercent(currentSales.length, previousSales.length),
      trend7: trend(currentSales, period.current.to, 7),
      trend30: trend(currentSales, period.current.to, 30),
    },
    inventory: {
      available: sum(source.inventory, (position) => position.available),
      reserved: sum(source.inventory, (position) => position.reserved),
      inspection: sum(source.inventory, (position) => position.inspection),
      defective: sum(source.inventory, (position) => position.defective),
      lowStockProducts,
      slowStockUnits,
      boundCapitalCents: sum(
        source.inventory.filter((position) => position.inventoryType === "OWNED"),
        (position) => position.available * position.unitCostCents
      ),
      ownedUnits: sum(
        source.inventory.filter((position) => position.inventoryType === "OWNED"),
        (position) => position.available
      ),
      consignmentUnits: sum(
        source.inventory.filter((position) => position.inventoryType === "CONSIGNMENT"),
        (position) => position.available
      ),
    },
    margin: {
      feeLoadPercent: ratioPercent(
        sum(currentSales, (sale) => sale.platformFeeCents),
        revenueCents
      ),
      shippingLoadPercent: ratioPercent(
        sum(currentSales, (sale) => sale.shippingCostCents),
        revenueCents
      ),
      belowTargetCount: currentSales.filter(
        (sale) => ratioPercent(sale.profitCents, sale.revenueCents) < 10
      ).length,
      distribution: marginDistribution(currentSales),
      strongestProducts: [...rankings]
        .sort((a, b) => b.profitCents - a.profitCents)
        .slice(0, 5),
      weakestProducts: [...rankings]
        .sort((a, b) => a.profitCents - b.profitCents)
        .slice(0, 5),
    },
    returns: {
      customer: {
        count: customerReturns.length,
        ratePercent: ratioPercent(customerReturns.length, currentSales.length),
        lossCents: sum(customerReturns, (item) => item.lossCents),
        openCount: customerReturns.filter((item) => item.open).length,
      },
      supplier: {
        openCount: openSupplierReturns.length,
        deadlineCount: supplierDeadlines.length,
        openRefundCents,
        boundCapitalCents: sum(
          openSupplierReturns,
          (item) => item.boundCapitalCents
        ),
      },
    },
    cash: {
      openDebtCents,
      expectedPayoutCents,
      oneTimeExpenseCents,
      recurringExpenseCents,
      profitBeforeExpensesCents: profitCents,
      profitAfterExpensesCents: profitCents - expenseCents,
      cashRecoveryPercent:
        expectedSupplierRecovery === 0
          ? null
          : Math.min(100, ratioPercent(actualSupplierRecovery, expectedSupplierRecovery)),
    },
    team: {
      openCount: openTasks.length,
      overdueCount: overdueTasks.length,
      blockerCount: openTasks.filter((task) => task.blocker).length,
      averageCycleDays,
      byMember: [...byMember.entries()]
        .map(([label, openCount]) => ({ label, openCount }))
        .sort((a, b) => b.openCount - a.openCount || a.label.localeCompare(b.label)),
    },
    attention: buildAttention({
      overdueTasks: overdueTasks.length,
      supplierDeadlines: supplierDeadlines.length,
      openSupplierRefunds: openSupplierRefunds.length,
      lowStockProducts,
      missingBookings,
      shippingActions,
      openDebts: openDebts.length,
      purchaseDeadlines: source.purchaseDeadlines.filter(
        (item) => item.deadline >= todayStart && item.deadline <= deadlineCutoff
      ).length,
      importConflicts: source.importConflicts,
      saleDateQuery: `&von=${period.current.from.toISOString().slice(0, 10)}&bis=${period.current.to.toISOString().slice(0, 10)}`,
    }),
  };
}
