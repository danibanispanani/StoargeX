import { requireOrg } from "@/lib/org";
import { StockItemStatus } from "@prisma/client";
import { formatEuro } from "@/lib/calculations";
import { STOCK_STATUS_LABELS } from "@/lib/constants";
import { CreateStockItemDialog } from "@/components/stock/create-stock-item-dialog";
import { StockFilterBar } from "@/components/stock/stock-filter-bar";
import { StockStatusSelect } from "@/components/stock/stock-status-select";
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

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { db } = await requireOrg();
  const { q, status } = await searchParams;

  const statusFilter =
    status && status in STOCK_STATUS_LABELS
      ? (status as StockItemStatus)
      : undefined;

  const [items, platforms] = await Promise.all([
    db.stockItem.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { model: { contains: q, mode: "insensitive" } },
                { variant: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
                { ean: { contains: q } },
                { supplier: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { listings: { include: { platform: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.platform.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lager</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} Artikel {q || statusFilter ? "(gefiltert)" : ""}
          </p>
        </div>
        <CreateStockItemDialog platforms={platforms} />
      </div>

      <StockFilterBar q={q ?? ""} status={status ?? ""} />

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead>Größe</TableHead>
                <TableHead>Händler</TableHead>
                <TableHead className="text-right">EK brutto</TableHead>
                <TableHead className="text-right">EK netto</TableHead>
                <TableHead>Gelistet auf</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Keine Artikel gefunden.
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {[item.model, item.variant].filter(Boolean).join(" · ")}
                      {item.quantity > 1 && ` · ${item.quantity} Stk.`}
                    </div>
                  </TableCell>
                  <TableCell>{item.size ?? "–"}</TableCell>
                  <TableCell>{item.supplier ?? "–"}</TableCell>
                  <TableCell className="text-right">
                    {formatEuro(item.purchasePriceCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.purchaseNetCents !== null
                      ? formatEuro(item.purchaseNetCents)
                      : "–"}
                    {item.inputTaxDeductible && (
                      <span className="ml-1 text-xs text-muted-foreground">(VSt)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.listings.length === 0 && (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                      {item.listings.map((listing) => (
                        <Badge key={listing.id} variant="outline">
                          {listing.platform.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StockStatusSelect
                      stockItemId={item.id}
                      currentStatus={item.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
