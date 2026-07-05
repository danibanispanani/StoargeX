import type { TenantDb } from "@/lib/tenant-db";

// Aggregationen für Dashboard & Berichte – direkt aus Sale/Return/Task
// (ersetzt die manuellen SUMIFS-Auswertungen der Excel-Lösung).

export const PERIOD_OPTIONS = [
  { value: "7", label: "Letzte 7 Tage" },
  { value: "30", label: "Letzte 30 Tage" },
  { value: "90", label: "Letzte 90 Tage" },
  { value: "365", label: "Letzte 12 Monate" },
  { value: "alle", label: "Gesamter Zeitraum" },
] as const;

export function periodToFrom(zeitraum: string | undefined): Date | null {
  const days: Record<string, number> = { "7": 7, "30": 30, "90": 90, "365": 365 };
  const d = days[zeitraum ?? "30"];
  return d ? new Date(Date.now() - d * 24 * 60 * 60 * 1000) : null;
}

export interface Kpis {
  salesCount: number;
  revenueCents: number; // Umsatz (VK brutto)
  profitCents: number; // Gewinn aus Verkäufen
  feesCents: number;
  shippingCents: number;
  openReturnsCount: number;
  returnLossCents: number; // Verluste aus Retouren im Zeitraum
  dueTasksCount: number; // fällige, nicht erledigte Aufgaben
}

export async function loadKpis(
  db: TenantDb,
  filter: { from: Date | null; platformId?: string }
): Promise<Kpis> {
  const saleWhere = {
    ...(filter.from ? { soldAt: { gte: filter.from } } : {}),
    ...(filter.platformId ? { platformId: filter.platformId } : {}),
  };
  const returnWhere = {
    ...(filter.from ? { requestedAt: { gte: filter.from } } : {}),
    ...(filter.platformId ? { sale: { platformId: filter.platformId } } : {}),
  };

  const [sales, openReturns, returnLoss, dueTasks] = await Promise.all([
    db.sale.aggregate({
      where: saleWhere,
      _count: true,
      _sum: {
        salePriceCents: true,
        profitCents: true,
        platformFeeCents: true,
        paymentFeeCents: true,
        shippingCostCents: true,
      },
    }),
    db.return.count({
      where: { ...returnWhere, status: { in: ["REQUESTED", "RECEIVED"] } },
    }),
    db.return.aggregate({ where: returnWhere, _sum: { lossCents: true } }),
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
    feesCents: (sales._sum.platformFeeCents ?? 0) + (sales._sum.paymentFeeCents ?? 0),
    shippingCents: sales._sum.shippingCostCents ?? 0,
    openReturnsCount: openReturns,
    returnLossCents: returnLoss._sum.lossCents ?? 0,
    dueTasksCount: dueTasks,
  };
}

export interface GroupRow {
  key: string;
  salesCount: number;
  revenueCents: number;
  profitCents: number;
  feesCents: number;
}

/** Verkäufe im Zeitraum nach Plattform und Monat gruppieren. */
export async function loadSaleBreakdowns(
  db: TenantDb,
  filter: { from: Date | null; platformId?: string }
): Promise<{ byPlatform: GroupRow[]; byMonth: GroupRow[] }> {
  const sales = await db.sale.findMany({
    where: {
      ...(filter.from ? { soldAt: { gte: filter.from } } : {}),
      ...(filter.platformId ? { platformId: filter.platformId } : {}),
    },
    select: {
      soldAt: true,
      salePriceCents: true,
      profitCents: true,
      platformFeeCents: true,
      paymentFeeCents: true,
      platform: { select: { name: true } },
    },
    orderBy: { soldAt: "asc" },
  });

  const byPlatform = new Map<string, GroupRow>();
  const byMonth = new Map<string, GroupRow>();

  for (const sale of sales) {
    const month = `${sale.soldAt.getFullYear()}-${String(sale.soldAt.getMonth() + 1).padStart(2, "0")}`;
    for (const [map, key] of [
      [byPlatform, sale.platform.name],
      [byMonth, month],
    ] as const) {
      const row = map.get(key) ?? {
        key,
        salesCount: 0,
        revenueCents: 0,
        profitCents: 0,
        feesCents: 0,
      };
      row.salesCount += 1;
      row.revenueCents += sale.salePriceCents;
      row.profitCents += sale.profitCents;
      row.feesCents += sale.platformFeeCents + sale.paymentFeeCents;
      map.set(key, row);
    }
  }

  return {
    byPlatform: [...byPlatform.values()].sort((a, b) => b.revenueCents - a.revenueCents),
    byMonth: [...byMonth.values()].sort((a, b) => b.key.localeCompare(a.key)),
  };
}
