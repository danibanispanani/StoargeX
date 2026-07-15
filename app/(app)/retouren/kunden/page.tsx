import { requireOrg } from "@/lib/org";
import { formatEuro } from "@/lib/calculations";
import { CreateReturnDialog, type ReturnableSaleOption } from "@/components/returns/create-return-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { EditReturnDialog } from "@/components/returns/edit-return-dialog";
import { ReturnStatusSelect } from "@/components/returns/return-status-select";
import { ReturnWorkflowActions } from "@/components/returns/return-workflow-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import {
  DetailDrawer,
  DetailGrid,
  DetailSection,
} from "@/components/table/detail-drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CustomerReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const { db } = await requireOrg();
  const { preset } = await searchParams;

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

  function ReturnDetailDrawer({ ret }: { ret: (typeof returns)[number] }) {
    const relation = allocationLabel(ret);

    return (
      <DetailDrawer
        title={ret.returnNumber ?? ret.id.slice(0, 8)}
        description={`${ret.sale.orderNumber ?? "Verkauf"} · ${returnTitle(ret)}`}
      >
        <DetailSection title="Relation">
          <p className="font-mono text-xs">
            {ret.returnNumber ?? "R-…"} → {ret.sale.orderNumber ?? ret.sale.id.slice(0, 8)} →{" "}
            {returnTitle(ret)} {relation ? `→ ${relation}` : ""}
          </p>
          {ret.returnLines.flatMap((line) => line.returnAllocations).map((allocation) => (
            <p key={allocation.id} className="mt-1 font-mono text-xs text-muted-foreground">
              {allocation.saleLineAllocation.inventoryPosition.inventoryNumber} · Eingang {allocation.receiptMovementId ?? "offen"} · Einlagerung {allocation.restockMovementId ?? "–"} · Defekt {allocation.defectiveMovementId ?? "–"}
            </p>
          ))}
        </DetailSection>
        <DetailSection title="Retoure">
          <DetailGrid
            items={[
              { label: "Meldedatum", value: ret.requestedAt.toLocaleDateString("de-DE") },
              { label: "Eingangsdatum", value: ret.receivedAt?.toLocaleDateString("de-DE") ?? "–" },
              { label: "Status", value: ret.status },
              { label: "Problem", value: ret.reason ?? "–" },
              { label: "Zustand", value: ret.returnLines.map((line) => line.itemCondition ?? line.condition).filter(Boolean).join(" · ") || "–" },
              { label: "Menge", value: ret.returnLines.reduce((sum, line) => sum + line.quantity, 0) || "Legacy" },
              { label: "Eingelagert", value: ret.restocked ? "Ja" : "Nein" },
              { label: "Versand", value: [ret.carrier, ret.trackingNumber].filter(Boolean).join(" · ") || "–" },
            ]}
          />
        </DetailSection>
        {ret.evidenceUrls.length > 0 && (
          <DetailSection title="Bilder & Prüfnachweise">
            <div className="space-y-1">
              {ret.evidenceUrls.map((url) => (
                <a key={url} className="block break-all text-sm underline underline-offset-2" href={url} target="_blank" rel="noreferrer">
                  {url}
                </a>
              ))}
            </div>
          </DetailSection>
        )}
        {ret.inspectionNotes && (
          <DetailSection title="Prüfung"><p>{ret.inspectionNotes}</p></DetailSection>
        )}
        <DetailSection title="Finanzen">
          <DetailGrid
            items={[
              { label: "Erstattung", value: formatEuro(ret.refundAmountCents) },
              { label: "Zusatzkosten", value: formatEuro(ret.additionalCostsCents) },
              { label: "Rücksendekosten", value: formatEuro(ret.returnShippingCents) },
              { label: "Verlust", value: formatEuro(ret.lossCents) },
            ]}
          />
        </DetailSection>
        {ret.notes && (
          <DetailSection title="Kommentar">
            <p>{ret.notes}</p>
          </DetailSection>
        )}
      </DetailDrawer>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kundenretouren</h1>
          <p className="text-sm text-muted-foreground">
            {returns.length} Retoure(n)
            {returns.length > 0 && <> · Gesamtverlust {formatEuro(totalLoss)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ImportExportBar table="kundenretouren" />
          <CreateReturnDialog sales={saleOptions} />
        </div>
      </div>

      <CompactTableShell
        storageKey="kundenretouren"
        requestedView={customerReturnView(preset)}
        views={[
          { value: "standard", label: "Standard" },
          { value: "workflow", label: "Prüfung" },
          { value: "finanzen", label: "Finanzen" },
          { value: "refund", label: "Erstattung" },
          { value: "all", label: "Alle Spalten" },
        ]}
      >
      <Card>
        <CardContent>
          <Table className="sx-datatable">
            <TableHeader>
              <TableRow>
                <TableHead data-column data-view-standard data-view-finanzen data-view-refund data-view-workflow data-view-all>R-Nummer</TableHead>
                <TableHead data-column data-view-standard data-view-all>Meldedatum</TableHead>
                <TableHead data-column data-view-standard data-view-workflow data-view-all>Verkauf</TableHead>
                <TableHead data-column data-view-standard data-view-workflow data-view-all>Artikel</TableHead>
                <TableHead data-column data-view-standard data-view-workflow data-view-all className="text-right">Menge</TableHead>
                <TableHead data-column data-view-standard data-view-all>Problem</TableHead>
                <TableHead data-column data-view-finanzen data-view-refund data-view-all className="text-right">Erstattung</TableHead>
                <TableHead data-column data-view-finanzen data-view-refund data-view-all className="text-right">Zusatzkosten</TableHead>
                <TableHead data-column data-view-standard data-view-finanzen data-view-refund data-view-all className="text-right">Verlust</TableHead>
                <TableHead data-column data-view-standard data-view-workflow data-view-all>Status</TableHead>
                <TableHead data-column data-view-standard data-view-finanzen data-view-refund data-view-workflow data-view-all>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                    Noch keine Retouren erfasst.
                  </TableCell>
                </TableRow>
              )}
              {returns.map((ret) => (
                <TableRow
                  key={ret.id}
                  data-table-view-row
                  data-row-view-standard
                  data-row-view-workflow={["RECEIVED", "INSPECTION", "DEFECTIVE", "CONFLICT"].includes(ret.status) || undefined}
                  data-row-view-finanzen={(ret.lossCents !== 0 || ret.additionalCostsCents !== 0 || ret.returnShippingCents !== 0) || undefined}
                  data-row-view-refund={(ret.refundAmountCents !== 0 || ret.status === "REFUNDED") || undefined}
                  data-row-view-all
                >
                  <TableCell data-column data-view-standard data-view-finanzen data-view-refund data-view-workflow data-view-all className="font-mono text-xs">
                    {ret.returnNumber ?? ret.id.slice(0, 8)}
                    {ret.returnLines.length === 0 && (
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Legacy
                      </div>
                    )}
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-all>{ret.requestedAt.toLocaleDateString("de-DE")}</TableCell>
                  <TableCell data-column data-view-standard data-view-workflow data-view-all>
                    <div className="font-mono text-xs">{ret.sale.orderNumber ?? "–"}</div>
                    <div className="text-xs text-muted-foreground">
                      {ret.sale.platform.name}
                    </div>
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-workflow data-view-all className="sx-cell-primary max-w-72">
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
                  <TableCell data-column data-view-standard data-view-workflow data-view-all className="text-right">
                    {ret.returnLines.reduce((sum, line) => sum + line.quantity, 0) || "–"}
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-all className="max-w-44 truncate">
                    {ret.reason ?? "–"}
                  </TableCell>
                  <TableCell data-column data-view-finanzen data-view-refund data-view-all className="sx-cell-money text-right">
                    {formatEuro(ret.refundAmountCents)}
                  </TableCell>
                  <TableCell data-column data-view-finanzen data-view-refund data-view-all className="sx-cell-money text-right">
                    {formatEuro(ret.additionalCostsCents + ret.returnShippingCents)}
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-finanzen data-view-refund data-view-all className="sx-cell-money text-right font-medium text-destructive">
                    {formatEuro(ret.lossCents)}
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-workflow data-view-all>
                    <div className="flex items-center gap-2">
                      <ReturnStatusSelect returnId={ret.id} currentStatus={ret.status} />
                      {ret.restocked && <Badge variant="outline">eingelagert</Badge>}
                    </div>
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-finanzen data-view-refund data-view-workflow data-view-all>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ReturnDetailDrawer ret={ret} />
                        <EditReturnDialog
                          ret={{
                            id: ret.id,
                            saleLabel: `${ret.sale.orderNumber ?? ""} ${returnTitle(ret)}`,
                            requestedAt: ret.requestedAt.toISOString().slice(0, 10),
                            reason: ret.reason ?? "",
                            refundAmount: (ret.refundAmountCents / 100).toFixed(2).replace(".", ","),
                            extraCost: (ret.additionalCostsCents / 100).toFixed(2).replace(".", ","),
                            returnShipping: (ret.returnShippingCents / 100).toFixed(2).replace(".", ","),
                            notes: ret.notes ?? "",
                          }}
                        />
                      </div>
                      <ReturnWorkflowActions
                        returnId={ret.id}
                        status={ret.status}
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
      </CompactTableShell>
    </div>
  );
}

function customerReturnView(value?: string): string | undefined {
  return ["standard", "workflow", "finanzen", "refund", "all"].includes(value ?? "")
    ? value
    : undefined;
}
