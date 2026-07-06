import Link from "next/link";
import { requireOrg } from "@/lib/org";
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
import { cn } from "@/lib/utils";

function saleModels(items: Array<{ stockItem: { title: string } | null; consignment: { itemTitle: string } | null }>) {
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
    { label: "Umsatz", value: formatEuro(kpis.revenueCents), hint: `VK brutto · ${range.label}` },
    {
      label: "Gewinn",
      value: formatEuro(kpis.profitCents),
      hint: range.label,
      negative: kpis.profitCents < 0,
    },
    { label: "Verkäufe", value: String(kpis.salesCount), hint: range.label },
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{organization.name}</h1>
          <p className="text-sm text-muted-foreground">Cockpit · Zeitraum: {range.label}</p>
        </div>
        <DashboardFilter jahr={params.jahr ?? ""} von={params.von ?? ""} bis={params.bis ?? ""} />
      </div>

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

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const inner = (
            <Card className={cn("h-full", card.href && "hover-lift")}>
              <CardHeader className="gap-1 p-4">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle
                  className={cn(
                    "text-2xl",
                    card.negative && "text-customs-red",
                    card.warn && "text-cargo-amber"
                  )}
                >
                  {card.value}
                </CardTitle>
                <CardDescription className="text-xs">{card.hint}</CardDescription>
              </CardHeader>
            </Card>
          );
          return card.href ? (
            <Link key={card.label} href={card.href}>
              {inner}
            </Link>
          ) : (
            <div key={card.label}>{inner}</div>
          );
        })}

        {/* Schulden-Saldo */}
        <Card className="h-full">
          <CardHeader className="gap-1 p-4">
            <CardDescription>Schulden-Saldo</CardDescription>
            {debtBalances.length === 0 ? (
              <p className="pt-1 text-sm text-muted-foreground">Alles ausgeglichen.</p>
            ) : (
              <ul className="space-y-0.5 pt-1 text-sm">
                {debtBalances.map((balance) => (
                  <li key={balance.person}>
                    {balance.netCents > 0 ? (
                      <>GbR schuldet {balance.person}:{" "}
                        <span className="font-mono font-medium text-customs-red">
                          {formatEuro(balance.netCents)}
                        </span>
                      </>
                    ) : (
                      <>{balance.person} schuldet GbR:{" "}
                        <span className="font-mono font-medium text-transit-teal">
                          {formatEuro(-balance.netCents)}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardHeader>
        </Card>
      </div>

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
        <Card>
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
                    <TableCell className="max-w-40 truncate">{saleModels(sale.items)}</TableCell>
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

        <Card>
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
