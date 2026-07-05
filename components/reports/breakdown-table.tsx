import { formatEuro } from "@/lib/calculations";
import type { GroupRow } from "@/lib/reporting";
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

export function BreakdownTable({
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
                <TableCell className="text-right font-mono">{formatEuro(row.revenueCents)}</TableCell>
                <TableCell className="text-right font-mono">{formatEuro(row.feesCents)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono",
                    row.profitCents < 0 ? "text-destructive" : "text-green-700 dark:text-green-400"
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
                <TableCell className="text-right font-mono">{formatEuro(totals.revenueCents)}</TableCell>
                <TableCell className="text-right font-mono">{formatEuro(totals.feesCents)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono",
                    totals.profitCents < 0 ? "text-destructive" : "text-green-700 dark:text-green-400"
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
