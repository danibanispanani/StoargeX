import { requireOrg } from "@/lib/org";
import { formatEuro } from "@/lib/calculations";
import { CreateReturnDialog } from "@/components/returns/create-return-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { EditReturnDialog } from "@/components/returns/edit-return-dialog";
import { ReturnStatusSelect } from "@/components/returns/return-status-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReturnsPage() {
  const { db } = await requireOrg();

  const [returns, sales] = await Promise.all([
    db.return.findMany({
      include: {
        sale: {
          include: {
            items: {
              include: {
                stockItem: { select: { title: true, sku: true } },
                consignment: { select: { itemTitle: true, sku: true } },
              },
            },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
      take: 200,
    }),
    // Verkäufe für den FK-Select im Dialog (nur nicht bereits erstattete)
    db.sale.findMany({
      where: { status: { not: "REFUNDED" } },
      include: {
        items: {
          include: {
            stockItem: { select: { title: true } },
            consignment: { select: { itemTitle: true } },
          },
        },
      },
      orderBy: { soldAt: "desc" },
      take: 500,
    }),
  ]);

  const saleTitle = (items: Array<{ stockItem: { title: string } | null; consignment: { itemTitle: string } | null }>) =>
    items
      .map((i) => i.stockItem?.title ?? i.consignment?.itemTitle)
      .filter(Boolean)
      .join(", ") || "–";

  const totalLoss = returns.reduce((sum, r) => sum + r.lossCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Retouren</h1>
          <p className="text-sm text-muted-foreground">
            {returns.length} Retoure(n)
            {returns.length > 0 && <> · Gesamtverlust {formatEuro(totalLoss)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ImportExportBar table="retouren" />
          <CreateReturnDialog
            sales={sales.map((s) => ({
              id: s.id,
              label: `${s.orderNumber ?? s.id.slice(0, 8)} – ${saleTitle(s.items)} (${formatEuro(s.salePriceCents)})`,
            }))}
          />
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meldedatum</TableHead>
                <TableHead>Verkauf</TableHead>
                <TableHead>Grund</TableHead>
                <TableHead className="text-right">Erstattung</TableHead>
                <TableHead className="text-right">Zusatzkosten</TableHead>
                <TableHead className="text-right">Verlust</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Noch keine Retouren erfasst – hoffentlich bleibt das so.
                    Über „Retoure erfassen&ldquo; verknüpfst du eine Retoure mit einem
                    Verkauf; der Verlust wird automatisch berechnet.
                  </TableCell>
                </TableRow>
              )}
              {returns.map((ret) => (
                <TableRow key={ret.id}>
                  <TableCell>{ret.requestedAt.toLocaleDateString("de-DE")}</TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">{ret.sale.orderNumber ?? "–"}</div>
                    <div className="text-xs text-muted-foreground">
                      {saleTitle(ret.sale.items)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{ret.reason ?? "–"}</TableCell>
                  <TableCell className="text-right">
                    {formatEuro(ret.refundAmountCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEuro(ret.returnShippingCents)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    {formatEuro(ret.lossCents)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ReturnStatusSelect returnId={ret.id} currentStatus={ret.status} />
                      {ret.restocked && <Badge variant="outline">eingelagert</Badge>}
                      <EditReturnDialog
                        ret={{
                          id: ret.id,
                          saleLabel: `${ret.sale.orderNumber ?? ""} ${saleTitle(ret.sale.items)}`,
                          requestedAt: ret.requestedAt.toISOString().slice(0, 10),
                          reason: ret.reason ?? "",
                          refundAmount: (ret.refundAmountCents / 100).toFixed(2).replace(".", ","),
                          extraCost: (ret.returnShippingCents / 100).toFixed(2).replace(".", ","),
                          notes: ret.notes ?? "",
                        }}
                      />
                    </div>
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
