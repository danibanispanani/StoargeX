import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { formatEuro } from "@/lib/calculations";
import { loadKpis, periodToFrom } from "@/lib/reporting";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
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

  const [kpis, platforms] = await Promise.all([
    loadKpis(db, { from: periodToFrom(zeitraum), platformId: platformId || undefined }),
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
            KPI-Übersicht · Details unter{" "}
            <Link href="/berichte" className="underline">
              Berichte
            </Link>
          </p>
        </div>
        <ReportFilterBar
          basePath="/dashboard"
          zeitraum={zeitraum}
          platformId={platformId}
          platforms={platforms}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const inner = (
            <Card key={card.label} className={cn(card.href && "transition-colors hover:bg-muted/40")}>
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
    </div>
  );
}
