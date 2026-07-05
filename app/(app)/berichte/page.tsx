import { requireOrg } from "@/lib/org";
import { formatEuro } from "@/lib/calculations";
import { loadKpis, loadSaleBreakdowns, periodToFrom, type GroupRow } from "@/lib/reporting";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
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

function BreakdownTable({
  title,
  description,
  keyHeader,
  rows,
}: {
  title: string;
  description: string;
  keyHeader: string;
  rows: GroupRow[];
}) {
  const totals = rows.reduce(
    (acc, row) => ({
      salesCount: acc.salesCount + row.salesCount,
      revenueCents: acc.revenueCents + row.revenueCents,
      profitCents: acc.profitCents + row.profitCents,
      feesCents: acc.feesCents + row.feesCents,
    }),
    { salesCount: 0, revenueCents: 0, profitCents: 0, feesCents: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{keyHeader}</TableHead>
              <TableHead className="text-right">Verkäufe</TableHead>
              <TableHead className="text-right">Umsatz</TableHead>
              <TableHead className="text-right">Gebühren</TableHead>
              <TableHead className="text-right">Gewinn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Keine Verkäufe im gewählten Zeitraum.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.key}</TableCell>
                <TableCell className="text-right">{row.salesCount}</TableCell>
                <TableCell className="text-right">{formatEuro(row.revenueCents)}</TableCell>
                <TableCell className="text-right">{formatEuro(row.feesCents)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right",
                    row.profitCents < 0 ? "text-destructive" : "text-green-700"
                  )}
                >
                  {formatEuro(row.profitCents)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="bg-muted/50 font-medium">
                <TableCell>Summe</TableCell>
                <TableCell className="text-right">{totals.salesCount}</TableCell>
                <TableCell className="text-right">{formatEuro(totals.revenueCents)}</TableCell>
                <TableCell className="text-right">{formatEuro(totals.feesCents)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right",
                    totals.profitCents < 0 ? "text-destructive" : "text-green-700"
                  )}
                >
                  {formatEuro(totals.profitCents)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string; plattform?: string }>;
}) {
  const { db } = await requireOrg();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Berichte</h1>
          <p className="text-sm text-muted-foreground">
            Aggregiert direkt aus Verkäufen, Retouren und Aufgaben – keine
            manuellen SUMIFS mehr.
          </p>
        </div>
        <ReportFilterBar
          basePath="/berichte"
          zeitraum={zeitraum}
          platformId={platformId}
          platforms={platforms}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zusammenfassung</CardTitle>
          <CardDescription>
            {kpis.salesCount} Verkäufe · Umsatz {formatEuro(kpis.revenueCents)} ·
            Gewinn {formatEuro(kpis.profitCents)} · Retouren-Verlust{" "}
            {formatEuro(kpis.returnLossCents)} · Gewinn nach Retouren{" "}
            <strong>{formatEuro(kpis.profitCents - kpis.returnLossCents)}</strong>
          </CardDescription>
        </CardHeader>
      </Card>

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
  );
}
