import { redirect } from "next/navigation";
import { DEFAULT_TABLE_PAGE_SIZE } from "@/lib/operational-table";
import { resolveReadOrgContext } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { formatEuro } from "@/lib/calculations";
import { type EditableSale } from "@/components/sales/sale-dialog";
import { LazySaleDialog } from "@/components/sales/lazy-sale-dialog";
import { LazyCreateSaleDialog } from "@/components/sales/lazy-create-sale-dialog";
import { SaleFilterBar } from "@/components/sales/sale-filter-bar";
import { InvoiceSelect, SaleStatusSelect } from "@/components/sales/sale-inline-selects";
import { CancelSaleButton } from "@/components/sales/cancel-sale-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import { OperationalPagination } from "@/components/table/operational-pagination";
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
import { cn } from "@/lib/utils";
import {
  OPERATIONAL_MODULES,
  operationalSearchParams,
  parseOperationalSearchQuery,
  parseOperationalModuleView,
} from "@/lib/operational-modules";
import { loadSalesInitialRead } from "@/lib/sales/sales-read-loader";
import { createSalesPerformanceTrace } from "@/lib/sales/sales-performance";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    rechnung?: string;
    buchung?: string;
    porto?: string;
    platform?: string;
    versandart?: string;
    von?: string;
    bis?: string;
    preset?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const trace = await createSalesPerformanceTrace("sales.page");
  const readContextStartedAt = performance.now();
  const access = await resolveReadOrgContext();
  trace.record("read_org.resolve", performance.now() - readContextStartedAt);
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    throw new Error("Keine Berechtigung fuer diese Aktion.");
  }
  const { db, organizationId, userId, source: readContextSource } = access.context;
  const rawParams = await searchParams;
  const normalizedQuery = parseOperationalSearchQuery(rawParams.q);
  const params = { ...rawParams, q: normalizedQuery || undefined };
  const requestedView = parseOperationalModuleView(OPERATIONAL_MODULES.sales, params.preset);
  const {
    rows,
    platforms,
    shippingMethodOptions,
    totalResults,
    page,
    pageSize,
    rowCounts,
  } = await loadSalesInitialRead({
    db,
    organizationId,
    params,
    view: requestedView,
    trace,
  });

  const sum = rows.reduce(
    (acc, row) => ({
      gross: acc.gross + row.sale.salePriceCents,
      profit: acc.profit + row.sale.profitCents,
      qty: acc.qty + row.sale.quantity,
    }),
    { gross: 0, profit: 0, qty: 0 }
  );
  const currentQuery = operationalSearchParams({
    ...params,
    preset: requestedView === "standard" ? undefined : requestedView,
    page: page > 1 ? String(page) : undefined,
    pageSize: pageSize === DEFAULT_TABLE_PAGE_SIZE ? undefined : String(pageSize),
  });
  trace.finish({
    readContextSource,
    salesRows: rowCounts.sales,
    platformOptions: rowCounts.platforms,
    shippingMethods: rowCounts.shippingMethods,
  });

  function toEditable(row: (typeof rows)[number]): EditableSale {
    const { sale } = row;
    return {
      id: sale.id,
      orderNumber: sale.orderNumber ?? sale.id.slice(0, 8),
      soldAt: sale.soldAt.toISOString().slice(0, 10),
      itemLabels: row.itemInfos.map((item) => `${item.sku} ${item.model}`),
      platformId: sale.platformId,
      marketplaceAccountId: sale.marketplaceAccountId ?? "",
      saleGross: (sale.salePriceCents / 100).toFixed(2).replace(".", ","),
      buyerCountry: sale.buyerCountry,
      shippingMethod: sale.shippingMethod ?? "",
      shippingCost: (sale.shippingCostCents / 100).toFixed(2).replace(".", ","),
      platformFeeGross: (sale.platformFeeCents / 100).toFixed(2).replace(".", ","),
      feeInclVat: sale.feeInclVat,
      platformFeeNet: "",
      payoutRecipient: sale.payoutRecipient ?? "",
      status: sale.status === "COMPLETED" ? "COMPLETED" : "PENDING",
      invoiceDone: sale.invoiceCreated,
      notes: sale.notes ?? "",
    };
  }

  function SaleDetailDrawer({ row }: { row: (typeof rows)[number] }) {
    const allocationLabels = row.sale.saleLines.flatMap((line) =>
      line.allocations.map(
        (allocation) =>
          `${allocation.inventoryPosition.inventoryNumber} × ${allocation.quantity}`
      )
    );

    return (
      <DetailDrawer
        title={row.sale.orderNumber ?? row.sale.id.slice(0, 8)}
        description={row.itemInfos.map((item) => item.model).join(", ")}
      >
        <DetailSection title="Verkauf">
          <DetailGrid
            items={[
              { label: "Datum", value: row.sale.soldAt.toLocaleDateString("de-DE") },
              { label: "Menge", value: row.sale.quantity },
              { label: "Plattform", value: row.sale.platform.name },
              { label: "Status", value: row.sale.status },
              { label: "Rechnung", value: row.sale.invoiceCreated ? "Erledigt" : "Offen" },
              { label: "Relation", value: row.sale.historicalRelationStatus },
            ]}
          />
        </DetailSection>
        <DetailSection title="Artikel">
          <p>{row.itemInfos.map((item) => `${item.model} × ${item.quantity}`).join(" · ")}</p>
          <p className="font-mono text-xs">{row.itemInfos.map((item) => item.sku).join(" · ")}</p>
        </DetailSection>
        <DetailSection title="Finanzen">
          <DetailGrid
            items={[
              { label: "VK brutto", value: formatEuro(row.sale.salePriceCents) },
              { label: "VK netto", value: formatEuro(row.sale.saleNetCents) },
              { label: "Steuern", value: formatEuro(row.sale.salePriceCents - row.sale.saleNetCents) },
              { label: "EK netto", value: formatEuro(row.ekNetCents) },
              { label: "Gebühren", value: formatEuro(row.sale.platformFeeNetCents || row.sale.platformFeeCents) },
              { label: "Versand", value: formatEuro(row.sale.shippingCostCents) },
              { label: "Gewinn", value: formatEuro(row.sale.profitCents) },
              { label: "Marge", value: formatPercent(row.sale.profitCents, row.sale.salePriceCents) },
            ]}
          />
        </DetailSection>
        <DetailSection title="Versand und Auszahlung">
          <DetailGrid
            items={[
              { label: "Versandart", value: row.sale.shippingMethod ?? "–" },
              { label: "Land", value: row.sale.buyerCountry },
              { label: "Auszahlung", value: row.sale.payoutRecipient ?? "–" },
              {
                label: "Schulden",
                value: row.sale.debtLinks.length
                  ? row.sale.debtLinks
                      .map((link) => `${link.debt.debtNumber ?? "SCH"} · ${link.debt.status}`)
                      .join(", ")
                  : "–",
              },
            ]}
          />
        </DetailSection>
        <DetailSection title="Bestandsbezug">
          <p>{allocationLabels.length ? allocationLabels.join(" · ") : "Legacy oder ungeklärt"}</p>
        </DetailSection>
        {row.sale.notes && (
          <DetailSection title="Kommentar">
            <p>{row.sale.notes}</p>
          </DetailSection>
        )}
      </DetailDrawer>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Handel"
        title="Verkauf"
        description="Verkäufe, Zahlungen, Versand und Abschluss in einem Ablauf steuern."
        actions={<LazyCreateSaleDialog />}
      />

      <SaleFilterBar
        filters={{
          q: params.q ?? "",
          status: params.status ?? "",
          rechnung: params.rechnung ?? "",
          platform: params.platform ?? "",
          versandart: params.versandart ?? "",
          von: params.von ?? "",
          bis: params.bis ?? "",
        }}
        platforms={platforms}
        shippingMethods={shippingMethodOptions}
        activeView={requestedView}
        pageSize={pageSize}
      />

      <CompactTableShell
        definition={OPERATIONAL_MODULES.sales}
        clientPagination={false}
        scope={{ organizationId, userId }}
        currentQuery={currentQuery}
        totalResults={totalResults}
      >
      <Card className="rounded-none border-0 shadow-none">
        <CardContent className="overflow-x-auto">
          <Table className="sx-datatable">
            <TableHeader>
              <TableRow>
                <TableHead data-column data-column-key="number" data-view-standard data-view-finances data-view-shipping data-view-payout data-view-all className="sx-sticky-0">Verkauf</TableHead>
                <TableHead data-column data-column-key="date" data-view-standard data-view-finances data-view-all>Datum</TableHead>
                <TableHead data-column data-column-key="items" data-view-standard data-view-shipping data-view-all>Artikel</TableHead>
                <TableHead data-column data-column-key="quantity" data-view-standard data-view-all className="text-right">Menge</TableHead>
                <TableHead data-column data-column-key="gross" data-view-standard data-view-finances data-view-payout data-view-all className="text-right">VK brutto</TableHead>
                <TableHead data-column data-column-key="tax" data-view-finances data-view-all className="text-right">Steuern</TableHead>
                <TableHead data-column data-column-key="net" data-view-finances data-view-all className="text-right">VK netto</TableHead>
                <TableHead data-column data-column-key="cost" data-view-finances data-view-all className="text-right">EK netto</TableHead>
                <TableHead data-column data-column-key="fees" data-view-finances data-view-all className="text-right">Gebühren</TableHead>
                <TableHead data-column data-column-key="shippingCost" data-view-finances data-view-all className="text-right">Versand</TableHead>
                <TableHead data-column data-column-key="profit" data-view-standard data-view-finances data-view-all className="text-right">Gewinn</TableHead>
                <TableHead data-column data-column-key="margin" data-view-finances data-view-all className="text-right">Marge</TableHead>
                <TableHead data-column data-column-key="platform" data-view-standard data-view-shipping data-view-payout data-view-all>Plattform</TableHead>
                <TableHead data-column data-column-key="status" data-view-standard data-view-shipping data-view-all>Status</TableHead>
                <TableHead data-column data-column-key="invoice" data-view-standard data-view-finances data-view-all>Rechnung</TableHead>
                <TableHead data-column data-column-key="shipping" data-view-shipping data-view-all>Versandart</TableHead>
                <TableHead data-column data-column-key="country" data-view-shipping data-view-all>Land</TableHead>
                <TableHead data-column data-column-key="payout" data-view-standard data-view-payout data-view-all>Auszahlung</TableHead>
                <TableHead data-column data-column-key="debt" data-view-payout data-view-all>Schuldstatus</TableHead>
                <TableHead data-column data-column-key="actions" data-view-standard data-view-finances data-view-shipping data-view-payout data-view-all className="w-48 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={20} className="py-8 text-center text-muted-foreground">
                    Keine Verkäufe gefunden.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow
                  key={row.sale.id}
                  data-table-view-row
                  data-row-view-standard={(!row.sale.invoiceCreated || ["PENDING", "PAID", "SHIPPED"].includes(row.sale.status)) || undefined}
                  data-row-view-finances
                  data-row-view-shipping={(!["COMPLETED", "CANCELLED"].includes(row.sale.status) || Boolean(row.sale.shippingMethod)) || undefined}
                  data-row-view-payout={(Boolean(row.sale.payoutRecipient) || row.sale.debtLinks.length > 0) || undefined}
                  data-row-view-all
                >
                  <TableCell data-column data-column-key="number" data-view-standard data-view-finances data-view-shipping data-view-payout data-view-all className="sx-sticky-0 font-mono text-xs">
                    {row.sale.orderNumber ?? "–"}
                    {!row.hasNewLines && (
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Legacy
                      </div>
                    )}
                  </TableCell>
                  <TableCell data-column data-column-key="date" data-view-standard data-view-finances data-view-all className="whitespace-nowrap">
                    {row.sale.soldAt.toLocaleDateString("de-DE")}
                  </TableCell>
                  <TableCell data-column data-column-key="items" data-view-standard data-view-shipping data-view-all className="sx-cell-primary max-w-96">
                    <div className="truncate font-medium">
                      {[...new Set(row.itemInfos.map((item) => item.model))].join(", ")}
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">
                      {row.itemInfos.map((item) => item.sku).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell data-column data-column-key="quantity" data-view-standard data-view-all className="text-right">{row.sale.quantity}</TableCell>
                  <TableCell data-column data-column-key="gross" data-view-standard data-view-finances data-view-payout data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.salePriceCents)}
                  </TableCell>
                  <TableCell data-column data-column-key="tax" data-view-finances data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.salePriceCents - row.sale.saleNetCents)}
                  </TableCell>
                  <TableCell data-column data-column-key="net" data-view-finances data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.saleNetCents)}
                  </TableCell>
                  <TableCell data-column data-column-key="cost" data-view-finances data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.ekNetCents)}
                  </TableCell>
                  <TableCell data-column data-column-key="fees" data-view-finances data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.platformFeeNetCents || row.sale.platformFeeCents)}
                  </TableCell>
                  <TableCell data-column data-column-key="shippingCost" data-view-finances data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.shippingCostCents)}
                  </TableCell>
                  <TableCell
                    data-column
                    data-column-key="profit"
                    data-view-standard
                    data-view-finances
                    data-view-all
                    className={cn(
                      "sx-cell-money text-right font-mono font-medium",
                      row.sale.profitCents < 0
                        ? "text-customs-red"
                        : "text-transit-teal"
                    )}
                  >
                    {formatEuro(row.sale.profitCents)}
                    <div className="text-xs font-normal text-muted-foreground">
                      {formatPercent(row.sale.profitCents, row.sale.salePriceCents)} Marge
                    </div>
                  </TableCell>
                  <TableCell data-column data-column-key="margin" data-view-finances data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.marginCents)}
                  </TableCell>
                  <TableCell data-column data-column-key="platform" data-view-standard data-view-shipping data-view-payout data-view-all>
                    <Badge variant="outline">{row.sale.platform.name}</Badge>
                  </TableCell>
                  <TableCell data-column data-column-key="status" data-view-standard data-view-shipping data-view-all>
                    <SaleStatusSelect saleId={row.sale.id} status={row.sale.status} />
                  </TableCell>
                  <TableCell data-column data-column-key="invoice" data-view-standard data-view-finances data-view-all>
                    <InvoiceSelect saleId={row.sale.id} done={row.sale.invoiceCreated} />
                  </TableCell>
                  <TableCell data-column data-column-key="shipping" data-view-shipping data-view-all>{row.sale.shippingMethod ?? "–"}</TableCell>
                  <TableCell data-column data-column-key="country" data-view-shipping data-view-all>{row.sale.buyerCountry}</TableCell>
                  <TableCell data-column data-column-key="payout" data-view-standard data-view-payout data-view-all>{row.sale.payoutRecipient ?? "–"}</TableCell>
                  <TableCell data-column data-column-key="debt" data-view-payout data-view-all>
                    {row.sale.debtLinks.length
                      ? row.sale.debtLinks
                          .map((link) => `${link.debt.debtNumber ?? "SCH"} · ${link.debt.status}`)
                          .join(", ")
                      : "–"}
                  </TableCell>
                  <TableCell data-column data-column-key="actions" data-view-standard data-view-finances data-view-shipping data-view-payout data-view-all>
                    <div className="flex justify-end gap-1">
                      <SaleDetailDrawer row={row} />
                      <LazySaleDialog
                        sale={toEditable(row)}
                      />
                      {row.hasNewLines && row.sale.status !== "CANCELLED" && (
                        <CancelSaleButton saleId={row.sale.id} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow
                  className="bg-muted/50 font-medium"
                  data-table-view-row
                  data-row-view-finances
                  data-row-view-all
                >
                  <TableCell colSpan={20}>
                    <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 font-mono text-xs">
                      <span>{rows.length} Verkäufe · {sum.qty} Artikel</span>
                      <span>Umsatz {formatEuro(sum.gross)}</span>
                      <span className={sum.profit < 0 ? "text-customs-red" : "text-transit-teal"}>
                        Gewinn {formatEuro(sum.profit)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <OperationalPagination
        page={page}
        pageSize={pageSize}
        totalResults={totalResults}
        query={currentQuery}
      />
      </CompactTableShell>
    </div>
  );
}

function formatPercent(valueCents: number, basisCents: number) {
  if (basisCents === 0) return "0,0 %";
  return `${((valueCents / basisCents) * 100).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}
