import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { formatEuro } from "@/lib/calculations";
import { loadKpis, loadSaleBreakdowns, periodToFrom } from "@/lib/reporting";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { BreakdownTable } from "@/components/reports/breakdown-table";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string; plattform?: string }>;
}) {
  const { db, organization } = await requireOrg();
  const params = await searchParams;
  const zeitraum = params.zeitraum ?? "30";
  const platformId = params.plattform ?? "";
  const filter = {
    from: periodToFrom(zeitraum),
    platformId: platformId || undefined,
  };

  const [kpis, breakdowns, platforms] = await Promise.all([
    loadKpis(db, filter),
    loadSaleBreakdowns(db, filter),
    db.platform.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const cards = [
    {
      label: "Umsatz",
      value: formatEuro(kpis.revenueCents),
      hint: `${kpis.salesCount} Verkäufe`,
    },
    {
      label: "Gewinn",
      value: formatEuro(kpis.profitCents),
      hint: `nach Gebühren (${formatEuro(kpis.feesCents)}) und Versand (${formatEuro(kpis.shippingCents)})`,
      negative: kpis.profitCents < 0,
    },
    {
      label: "Offene Retouren",
      value: String(kpis.openReturnsCount),
      hint: `Verlust im Zeitraum: ${formatEuro(kpis.returnLossCents)}`,
      href: "/retouren",
    },
    {
      label: "Fällige Aufgaben",
      value: String(kpis.dueTasksCount),
      hint: "offen und Frist erreicht",
      href: "/aufgaben",
      negative: kpis.dueTasksCount > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{organization.name}</h1>
          <p className="text-sm text-muted-foreground">
            KPIs und Auswertungen – Gewinn nach Retouren:{" "}
            <strong
              className={cn(
                kpis.profitCents - kpis.returnLossCents < 0 && "text-destructive"
              )}
            >
              {formatEuro(kpis.profitCents - kpis.returnLossCents)}
            </strong>
          </p>
        </div>
        <ReportFilterBar
          basePath="/dashboard"
          zeitraum={zeitraum}
          platformId={platformId}
          platforms={platforms}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const inner = (
            <Card key={card.label} className={cn("h-full", card.href && "hover-lift")}>
              <CardHeader>
                <CardDescription>{card.label}</CardDescription>
                <CardTitle
                  className={cn("text-3xl", card.negative && "text-destructive")}
                >
                  {card.value}
                </CardTitle>
                <CardDescription>{card.hint}</CardDescription>
              </CardHeader>
            </Card>
          );
          return card.href ? (
            <Link key={card.label} href={card.href}>
              {inner}
            </Link>
          ) : (
            inner
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownTable
          title="Nach Plattform"
          description="Umsatz, Gebühren und Gewinn je Verkaufsplattform"
          keyHeader="Plattform"
          rows={breakdowns.byPlatform}
        />
        <BreakdownTable
          title="Nach Monat"
          description="Monatliche Entwicklung im gewählten Zeitraum"
          keyHeader="Monat"
          rows={breakdowns.byMonth}
        />
      </div>
    </div>
  );
}
