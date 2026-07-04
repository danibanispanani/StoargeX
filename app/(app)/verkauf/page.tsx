import { requireOrg } from "@/lib/org";
import { formatEuro } from "@/lib/calculations";
import { CreateSaleDialog } from "@/components/sales/create-sale-dialog";
import { SaleFilterBar } from "@/components/sales/sale-filter-bar";
import { SaleFlagCheckbox } from "@/components/sales/sale-flag-checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; platform?: string; land?: string }>;
}) {
  const { db } = await requireOrg();
  const { q, platform, land } = await searchParams;

  const where = {
    ...(platform ? { platformId: platform } : {}),
    ...(land ? { buyerCountry: land.toUpperCase() } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" as const } },
            { buyerUsername: { contains: q, mode: "insensitive" as const } },
            { stockItem: { title: { contains: q, mode: "insensitive" as const } } },
            { stockItem: { sku: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [sales, platforms, availableItems, totals] = await Promise.all([
    db.sale.findMany({
      where,
      include: {
        stockItem: { select: { title: true, sku: true } },
        platform: { select: { name: true } },
      },
      orderBy: { soldAt: "desc" },
      take: 200,
    }),
    db.platform.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.stockItem.findMany({
      where: { quantity: { gt: 0 }, status: { notIn: ["SOLD", "CANCELLED", "WRITTEN_OFF"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, sku: true, title: true, size: true },
      take: 500,
    }),
    db.sale.aggregate({
      where,
      _sum: {
        salePriceCents: true,
        saleNetCents: true,
        marginCents: true,
        profitCents: true,
        shippingCostCents: true,
        platformFeeCents: true,
        paymentFeeCents: true,
      },
    }),
  ]);

  const sum = totals._sum;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Verkauf</h1>
          <p className="text-sm text-muted-foreground">
            {sales.length} Verkäufe {q || platform || land ? "(gefiltert)" : ""}
          </p>
        </div>
        <CreateSaleDialog platforms={platforms} stockItems={availableItems} />
      </div>

      <SaleFilterBar
        q={q ?? ""}
        platform={platform ?? ""}
        land={land ?? ""}
        platforms={platforms}
      />

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order-ID</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Plattform</TableHead>
                <TableHead>Land</TableHead>
                <TableHead className="text-right">VK brutto</TableHead>
                <TableHead className="text-right">VK netto</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Gewinn</TableHead>
                <TableHead className="text-center">RG / Porto / Geb.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Keine Verkäufe gefunden.
                  </TableCell>
                </TableRow>
              )}
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-xs">
                    {sale.orderNumber ?? "–"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{sale.stockItem.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {sale.stockItem.sku}
                    </div>
                  </TableCell>
                  <TableCell>{sale.soldAt.toLocaleDateString("de-DE")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{sale.platform.name}</Badge>
                  </TableCell>
                  <TableCell>{sale.buyerCountry}</TableCell>
                  <TableCell className="text-right">
                    {formatEuro(sale.salePriceCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEuro(sale.saleNetCents)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({Number(sale.taxRatePercent)}%)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEuro(sale.marginCents)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      sale.profitCents < 0 ? "text-destructive" : "text-green-700"
                    )}
                  >
                    {formatEuro(sale.profitCents)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <SaleFlagCheckbox
                        saleId={sale.id}
                        field="invoiceCreated"
                        checked={sale.invoiceCreated}
                        title="Rechnung erstellt"
                      />
                      <SaleFlagCheckbox
                        saleId={sale.id}
                        field="postageBooked"
                        checked={sale.postageBooked}
                        title="Porto gebucht"
                      />
                      <SaleFlagCheckbox
                        saleId={sale.id}
                        field="feesBooked"
                        checked={sale.feesBooked}
                        title="Gebühren gebucht"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sales.length > 0 && (
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={5}>Summe ({sales.length} Verkäufe)</TableCell>
                  <TableCell className="text-right">
                    {formatEuro(sum.salePriceCents ?? 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEuro(sum.saleNetCents ?? 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEuro(sum.marginCents ?? 0)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      (sum.profitCents ?? 0) < 0 ? "text-destructive" : "text-green-700"
                    )}
                  >
                    {formatEuro(sum.profitCents ?? 0)}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    Versand {formatEuro(sum.shippingCostCents ?? 0)} · Geb.{" "}
                    {formatEuro((sum.platformFeeCents ?? 0) + (sum.paymentFeeCents ?? 0))}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
