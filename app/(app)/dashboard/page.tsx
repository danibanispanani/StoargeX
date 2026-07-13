import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { InsightStrip, type InsightItem } from "@/components/app/insight-strip";
import { hasMinRole } from "@/lib/roles";
import { formatEuro } from "@/lib/calculations";
import {
  loadDashboardKpis,
  loadDebtBalances,
  loadLowStockAlerts,
  loadOpenDebts,
  loadPlatformShare,
  loadPurchaseVsSaleMonthly,
  loadQuarterlyComparison,
  loadRecentSales,
  loadTopProducts,
  resolvePeriod,
} from "@/lib/reporting";
import {
  activityHref,
  activityText,
  type ActivityEntry,
} from "@/lib/activity";
import { DEBT_KIND_LABELS, DEBT_STATUS, SALE_STATUS } from "@/lib/constants";
import { DashboardFilter } from "@/components/dashboard/dashboard-filter";
import {
  FlowChart,
  PlatformPie,
  QuarterlyChart,
  TopProductsChart,
} from "@/components/dashboard/charts";
import { ActivityWidget } from "@/components/reports/activity-widget";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function saleModels(
  items: Array<{ stockItem: { title: string } | null; consignment: { itemTitle: string } | null }>,
  saleLines: Array<{ descriptionSnapshot: string }> = []
) {
  if (saleLines.length > 0) {
    return [...new Set(saleLines.map((line) => line.descriptionSnapshot))].join(", ");
  }
  return (
    [
      ...new Set(items.map((i) => i.stockItem?.title ?? i.consignment?.itemTitle).filter(Boolean)),
    ].join(", ") || "–"
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    jahr?: string;
    von?: string;
    bis?: string;
    akteur?: string;
    aktion?: string;
  }>;
}) {
  const { db, organization, membership } = await requireOrg();
  const params = await searchParams;
  const range = resolvePeriod(params.jahr, params.von, params.bis);
  const year = range.to.getFullYear();
  const isManager = hasMinRole(membership.role, "ADMIN");

  const [
    kpis,
    debtBalances,
    quarterly,
    monthlyFlow,
    platformShare,
    topProducts,
    recentSales,
    openDebts,
    lowStock,
    auditLogs,
    members,
  ] = await Promise.all([
    loadDashboardKpis(db, range),
    loadDebtBalances(db),
    loadQuarterlyComparison(db, year),
    loadPurchaseVsSaleMonthly(db, range),
    loadPlatformShare(db, range),
    loadTopProducts(db, range),
    loadRecentSales(db),
    loadOpenDebts(db),
    loadLowStockAlerts(db, organization.lowStockThreshold),
    isManager
      ? db.auditLog.findMany({
          where: {
            ...(params.akteur ? { userId: params.akteur } : {}),
            ...(params.aktion ? { action: { startsWith: params.aktion } } : {}),
          },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
    isManager
      ? db.membership.findMany({
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const activityEntries: ActivityEntry[] = auditLogs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt,
    actorName: log.user ? log.user.name ?? log.user.email : "System",
    text: activityText(log.action, log.after, log.before),
    href: activityHref(log.entityType),
  }));

  const kpiCards = [
    {
      label: "Umsatz",
      value: formatEuro(kpis.revenueCents),
      hint: `Summe VK brutto · ${range.label}`,
      href: "/verkauf",
    },
    {
      label: "Gewinn",
      value: formatEuro(kpis.profitCents),
      hint: `VK netto − EK − Gebühren − Versand · ${range.label}`,
      href: "/verkauf",
      negative: kpis.profitCents < 0,
    },
    {
      label: "Verkäufe",
      value: String(kpis.salesCount),
      hint: `Anzahl Buchungen · ${range.label}`,
      href: "/verkauf",
    },
    {
      label: "Offene Retouren",
      value: String(kpis.openReturnsCount),
      hint: "in Klärung",
      href: "/retouren",
      warn: kpis.openReturnsCount > 0,
    },
    {
      label: "Lagerbestand",
      value: String(kpis.stockInStockCount),
      hint: `auf Lager · ${kpis.stockInTransitCount} unterwegs`,
      href: "/lager",
    },
    {
      label: "Offene Rechnungen",
      value: String(kpis.openInvoicesCount),
      hint: "Rechnung = Offen",
      href: "/verkauf?rechnung=offen",
      warn: kpis.openInvoicesCount > 0,
    },
    {
      label: "Fällige Aufgaben",
      value: String(kpis.dueTasksCount),
      hint: "Frist heute/überschritten",
      href: "/aufgaben",
      warn: kpis.dueTasksCount > 0,
    },
  ];
  const debtDetail = debtBalances.length
    ? debtBalances
        .map((balance) =>
          balance.netCents > 0
            ? `GbR → ${balance.person}: ${formatEuro(balance.netCents)}`
            : `${balance.person} → GbR: ${formatEuro(-balance.netCents)}`
        )
        .join(" · ")
    : "Keine offenen Salden";
  const insights: InsightItem[] = [
    ...kpiCards.map((card) => ({
      label: card.label,
      value: card.value,
      detail: card.hint,
      href: card.href,
      tone: card.negative
        ? ("critical" as const)
        : card.warn
          ? ("warning" as const)
          : ("neutral" as const),
    })),
    {
      label: "Schulden-Saldo",
      value: debtBalances.length ? `${debtBalances.length} offen` : "Ausgeglichen",
      detail: debtDetail,
      href: "/schulden",
      tone: debtBalances.length ? "critical" : "positive",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operative Übersicht"
        title={organization.name}
        description={<>Cockpit · Zeitraum: {range.label}</>}
        actions={<DashboardFilter jahr={params.jahr ?? ""} von={params.von ?? ""} bis={params.bis ?? ""} />}
      />

      {/* Niedrig-Bestand-Warnungen */}
      {lowStock.length > 0 && (
        <div className="space-y-1 rounded-lg border border-cargo-amber/40 bg-cargo-amber/10 p-3">
          {lowStock.map((alert) => (
            <p key={alert.model} className="text-sm">
              <span className="font-medium text-amber-700 dark:text-amber-300">⚠ Niedriger Bestand:</span>{" "}
              {alert.model} – nur noch {alert.onHand} Stück
            </p>
          ))}
        </div>
      )}

      <InsightStrip items={insights} />

      {/* Diagramme */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quartalsvergleich Umsatz</CardTitle>
            <CardDescription>
              {quarterly.currentYear} vs. {quarterly.lastYear}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuarterlyChart
              rows={quarterly.rows}
              currentYear={quarterly.currentYear}
              lastYear={quarterly.lastYear}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Einkauf vs. Verkauf</CardTitle>
            <CardDescription>Summen pro Monat (brutto)</CardDescription>
          </CardHeader>
          <CardContent>
            <FlowChart rows={monthlyFlow} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verkäufe nach Plattform</CardTitle>
            <CardDescription>Umsatzanteil im Zeitraum</CardDescription>
          </CardHeader>
          <CardContent>
            <PlatformPie slices={platformShare} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Produkte nach Gewinn</CardTitle>
            <CardDescription>kumuliert im Zeitraum</CardDescription>
          </CardHeader>
          <CardContent>
            <TopProductsChart rows={topProducts} />
          </CardContent>
        </Card>
      </div>

      {/* Kompakt-Tabellen */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Letzte Verkäufe</CardTitle>
            <Link href="/verkauf" className="text-xs underline-offset-2 hover:underline">
              alle
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OrderID</TableHead>
                  <TableHead>Artikel</TableHead>
                  <TableHead className="text-right">VK brutto</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      Noch keine Verkäufe.
                    </TableCell>
                  </TableRow>
                )}
                {recentSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs">{sale.orderNumber ?? "–"}</TableCell>
                    <TableCell className="max-w-40 truncate">{saleModels(sale.items, sale.saleLines)}</TableCell>
                    <TableCell className="text-right font-mono">{formatEuro(sale.salePriceCents)}</TableCell>
                    <TableCell>
                      {SALE_STATUS[sale.status] && <StatusBadge style={SALE_STATUS[sale.status]!} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Offene Schulden</CardTitle>
            <Link href="/schulden" className="text-xs underline-offset-2 hover:underline">
              alle
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Art</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schuldner → Empf.</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openDebts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      Keine offenen Schulden.
                    </TableCell>
                  </TableRow>
                )}
                {openDebts.map((debt) => (
                  <TableRow key={debt.id}>
                    <TableCell className="max-w-36 truncate">{debt.description ?? "–"}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{DEBT_KIND_LABELS[debt.kind]}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge style={DEBT_STATUS[debt.status]} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {debt.debtorName} → {debt.creditorName}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatEuro(debt.amountCents - debt.paidCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {isManager && (
        <ActivityWidget
          entries={activityEntries}
          members={members.map((m) => ({ userId: m.userId, name: m.user.name ?? m.user.email }))}
          currentMember={params.akteur ?? ""}
          currentAction={params.aktion ?? ""}
        />
      )}
    </div>
  );
}
