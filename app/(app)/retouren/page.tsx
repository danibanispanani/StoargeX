import { requireOrg } from "@/lib/org";
import { formatEuro } from "@/lib/calculations";
import { CreateReturnDialog, type ReturnableSaleOption } from "@/components/returns/create-return-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { EditReturnDialog } from "@/components/returns/edit-return-dialog";
import { ReturnStatusSelect } from "@/components/returns/return-status-select";
import { ReturnWorkflowActions } from "@/components/returns/return-workflow-actions";
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
            platform: { select: { name: true } },
            items: {
              include: {
                stockItem: { select: { title: true, sku: true } },
                consignment: { select: { itemTitle: true, sku: true } },
              },
            },
          },
        },
        returnLines: {
          include: {
            saleLine: true,
            returnAllocations: {
              include: {
                saleLineAllocation: {
                  include: {
                    inventoryPosition: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
      take: 200,
    }),
    db.sale.findMany({
      where: { status: { not: "CANCELLED" }, saleLines: { some: {} } },
      include: {
        platform: { select: { name: true } },
        saleLines: {
          include: {
            allocations: {
              include: {
                inventoryPosition: {
                  include: {
                    product: true,
                    consignmentLot: true,
                  },
                },
                returnAllocations: true,
              },
            },
          },
        },
      },
      orderBy: { soldAt: "desc" },
      take: 500,
    }),
  ]);

  const saleOptions: ReturnableSaleOption[] = sales
    .map((sale) => {
      const lines = sale.saleLines
        .map((line) => {
          const allocations = line.allocations.map((allocation) => {
            const returned = allocation.returnAllocations.reduce(
              (sum, retAllocation) => sum + retAllocation.quantity,
              0
            );
            return {
              id: allocation.id,
              label: [
                allocation.inventoryPosition.inventoryNumber,
                allocation.inventoryPosition.product.name,
                allocation.inventoryPosition.product.variant,
                allocation.inventoryPosition.consignmentLot?.partnerCompany,
              ]
                .filter(Boolean)
                .join(" · "),
              sold: allocation.quantity,
              returned,
              returnable: Math.max(0, allocation.quantity - returned),
            };
          });
          return {
            id: line.id,
            label: [line.descriptionSnapshot, line.variantSnapshot, line.sizeSnapshot]
              .filter(Boolean)
              .join(" · "),
            quantity: line.quantity,
            allocations,
          };
        })
        .filter((line) => line.allocations.some((allocation) => allocation.returnable > 0));

      return {
        id: sale.id,
        label: `${sale.orderNumber ?? sale.id.slice(0, 8)} – ${sale.platform.name} – ${sale.soldAt.toLocaleDateString("de-DE")}`,
        search: [
          sale.orderNumber,
          sale.platform.name,
          sale.soldAt.toLocaleDateString("de-DE"),
          ...sale.saleLines.map((line) => line.descriptionSnapshot),
        ]
          .filter(Boolean)
          .join(" "),
        lines,
      };
    })
    .filter((sale) => sale.lines.length > 0);

  const totalLoss = returns.reduce((sum, ret) => sum + ret.lossCents, 0);

  function returnTitle(ret: (typeof returns)[number]): string {
    if (ret.returnLines.length > 0) {
      return ret.returnLines
        .map((line) => `${line.saleLine.descriptionSnapshot} × ${line.quantity}`)
        .join(", ");
    }
    return (
      ret.sale.items
        .map((item) => item.stockItem?.title ?? item.consignment?.itemTitle)
        .filter(Boolean)
        .join(", ") || "Legacy-Retoure"
    );
  }

  function allocationLabel(ret: (typeof returns)[number]): string {
    return ret.returnLines
      .flatMap((line) =>
        line.returnAllocations.map(
          (allocation) =>
            `${allocation.saleLineAllocation.inventoryPosition.inventoryNumber} × ${allocation.quantity}`
        )
      )
      .join(" · ");
  }

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
          <CreateReturnDialog sales={saleOptions} />
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Retoure</TableHead>
                <TableHead>Meldedatum</TableHead>
                <TableHead>Verkauf</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead className="text-right">Erstattung</TableHead>
                <TableHead className="text-right">Zusatzkosten</TableHead>
                <TableHead className="text-right">Verlust</TableHead>
                <TableHead>Status / Workflow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Noch keine Retouren erfasst.
                  </TableCell>
                </TableRow>
              )}
              {returns.map((ret) => (
                <TableRow key={ret.id}>
                  <TableCell className="font-mono text-xs">
                    {ret.returnNumber ?? ret.id.slice(0, 8)}
                    {ret.returnLines.length === 0 && (
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Legacy
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{ret.requestedAt.toLocaleDateString("de-DE")}</TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">{ret.sale.orderNumber ?? "–"}</div>
                    <div className="text-xs text-muted-foreground">
                      {ret.sale.platform.name}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-72">
                    <div className="truncate font-medium">{returnTitle(ret)}</div>
                    {allocationLabel(ret) && (
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {allocationLabel(ret)}
                      </div>
                    )}
                    {ret.reason && (
                      <div className="truncate text-xs text-muted-foreground">
                        {ret.reason}
                      </div>
                    )}
                  </TableCell>
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ReturnStatusSelect returnId={ret.id} currentStatus={ret.status} />
                        {ret.restocked && <Badge variant="outline">eingelagert</Badge>}
                        <EditReturnDialog
                          ret={{
                            id: ret.id,
                            saleLabel: `${ret.sale.orderNumber ?? ""} ${returnTitle(ret)}`,
                            requestedAt: ret.requestedAt.toISOString().slice(0, 10),
                            reason: ret.reason ?? "",
                            refundAmount: (ret.refundAmountCents / 100).toFixed(2).replace(".", ","),
                            extraCost: (ret.returnShippingCents / 100).toFixed(2).replace(".", ","),
                            notes: ret.notes ?? "",
                          }}
                        />
                      </div>
                      <ReturnWorkflowActions
                        returnId={ret.id}
                        disabled={ret.returnLines.length === 0}
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
