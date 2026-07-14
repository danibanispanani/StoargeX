import type { Prisma } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { getFeatureAccess } from "@/lib/feature-access";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";
import { getOptions } from "@/lib/options";
import { formatEuro } from "@/lib/calculations";
import { SaleDialog, type EditableSale, type SellableItem } from "@/components/sales/sale-dialog";
import { SaleFilterBar } from "@/components/sales/sale-filter-bar";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { InvoiceSelect, SaleStatusSelect } from "@/components/sales/sale-inline-selects";
import { CancelSaleButton } from "@/components/sales/cancel-sale-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    rechnung?: string;
    platform?: string;
    versandart?: string;
    von?: string;
    bis?: string;
  }>;
}) {
  const context = await requireOrg();
  const { db, organization } = context;
  const consignmentAccess = await getFeatureAccess(
    context,
    FEATURE_KEYS.CONSIGNMENT
  );
  const params = await searchParams;

  const where: Prisma.SaleWhereInput = {
    ...(params.status === "PENDING"
      ? { status: { in: ["PENDING", "PAID", "SHIPPED"] } }
      : params.status === "COMPLETED"
        ? { status: "COMPLETED" as const }
        : {}),
    ...(params.rechnung === "offen"
      ? { invoiceCreated: false }
      : params.rechnung === "erledigt"
        ? { invoiceCreated: true }
        : {}),
    ...(params.platform ? { platformId: params.platform } : {}),
    ...(params.versandart ? { shippingMethod: params.versandart } : {}),
    ...(params.von || params.bis
      ? {
          soldAt: {
            ...(params.von ? { gte: new Date(params.von) } : {}),
            ...(params.bis ? { lte: new Date(`${params.bis}T23:59:59`) } : {}),
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { orderNumber: { contains: params.q, mode: "insensitive" as const } },
            { notes: { contains: params.q, mode: "insensitive" as const } },
            {
              saleLines: {
                some: {
                  OR: [
                    {
                      descriptionSnapshot: {
                        contains: params.q,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      allocations: {
                        some: {
                          inventoryPosition: {
                            inventoryNumber: {
                              contains: params.q,
                              mode: "insensitive" as const,
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
            {
              items: {
                some: {
                  stockItem: {
                    OR: [
                      { title: { contains: params.q, mode: "insensitive" as const } },
                      { sku: { contains: params.q, mode: "insensitive" as const } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [sales, platforms, payoutOptions, rates, sellablePositions, marketplaceAccounts] =
    await Promise.all([
      db.sale.findMany({
        where,
        include: {
          platform: { select: { name: true } },
          debtLinks: {
            include: {
              debt: { select: { debtNumber: true, status: true } },
            },
          },
          saleLines: {
            include: {
              allocations: {
                include: {
                  inventoryPosition: {
                    include: {
                      consignmentLot: true,
                    },
                  },
                },
              },
            },
          },
          items: {
            include: {
              stockItem: { select: { sku: true, title: true, variant: true, size: true } },
              consignment: { select: { sku: true, itemTitle: true } },
            },
          },
        },
        orderBy: { soldAt: "desc" },
        take: 300,
      }),
      db.platform.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      getOptions(db, organization.id, "PAYOUT_RECIPIENT"),
      db.shippingRate.findMany({
        where: { active: true },
        orderBy: [{ carrierName: "asc" }, { name: "asc" }],
        select: {
          id: true,
          carrierName: true,
          name: true,
          countries: true,
          baseCents: true,
        },
      }),
      db.inventoryPosition.findMany({
        where: {
          active: true,
          quantityAvailable: { gt: 0 },
          ...(consignmentAccess.enabled ? {} : { inventoryType: "OWNED" as const }),
        },
        include: {
          product: true,
          consignmentLot: true,
        },
        orderBy: [{ inventoryType: "asc" }, { receivedAt: "asc" }],
        take: 500,
      }),
      db.marketplaceAccount.findMany({ where: { active: true }, include: { defaultFeeSchedule: true }, orderBy: { displayName: "asc" } }),
    ]);

  const sellable: SellableItem[] = sellablePositions.map((position) => ({
    ref: `inventory:${position.id}`,
    label: [
      position.inventoryNumber,
      position.product.name,
      position.product.variant,
      position.product.size,
      position.product.ean,
      position.consignmentLot?.partnerCompany,
    ]
      .filter(Boolean)
      .join(" · "),
    source: position.inventoryType === "OWNED" ? "Eigenbestand" : "Konsignation",
    available: position.quantityAvailable,
    partner: position.consignmentLot?.partnerCompany ?? null,
  }));

  const rows = sales.map((sale) => {
    const hasNewLines = sale.saleLines.length > 0;
    const itemInfos = hasNewLines
      ? sale.saleLines.map((line) => ({
          sku: line.allocations
            .map((allocation) => allocation.inventoryPosition.inventoryNumber)
            .join(", "),
          model: line.descriptionSnapshot,
          variant: line.variantSnapshot ?? "",
          size: line.sizeSnapshot ?? "",
          quantity: line.quantity,
        }))
      : sale.items.map((item) =>
          item.stockItem
            ? {
                sku: item.stockItem.sku,
                model: item.stockItem.title,
                variant: item.stockItem.variant ?? "",
                size: item.stockItem.size ?? "",
                quantity: 1,
              }
            : {
                sku: item.consignment?.sku ?? "?",
                model: item.consignment?.itemTitle ?? "?",
                variant: "",
                size: "",
                quantity: 1,
              }
        );
    const ekNetCents = hasNewLines
      ? sale.saleLines.reduce(
          (sum, line) =>
            sum +
            line.allocations.reduce(
              (lineSum, allocation) =>
                lineSum +
                allocation.quantity *
                  Math.round(Number(allocation.unitCostNetSnapshot) * 100),
              0
            ),
          0
        )
      : sale.items.reduce((sum, item) => sum + item.ekNetCents, 0);
    return { sale, itemInfos, ekNetCents, hasNewLines };
  });

  const sum = rows.reduce(
    (acc, row) => ({
      gross: acc.gross + row.sale.salePriceCents,
      profit: acc.profit + row.sale.profitCents,
      qty: acc.qty + row.sale.quantity,
    }),
    { gross: 0, profit: 0, qty: 0 }
  );

  const shippingMethodOptions = [
    ...new Set([
      ...rates.map((rate) => `${rate.carrierName} ${rate.name}`),
      "Abholung",
      "Vinted",
      "Sonstiges",
    ]),
  ];

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
        description={
          <>
            {rows.length} Verkäufe {Object.values(params).some(Boolean) ? "(gefiltert)" : ""}
          </>
        }
        actions={
          <>
            <ImportExportBar table="verkauf" />
            <SaleDialog items={sellable} platforms={platforms} marketplaceAccounts={marketplaceAccounts.map((account) => ({ id: account.id, platformId: account.platformId, displayName: account.displayName, catalogVersion: account.defaultFeeSchedule?.version ?? null }))} payoutOptions={payoutOptions} shippingRates={rates} />
          </>
        }
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
      />

      <CompactTableShell
        storageKey="verkauf"
        views={[
          { value: "standard", label: "Standard" },
          { value: "buchhaltung", label: "Buchhaltung" },
          { value: "versand", label: "Versand" },
          { value: "auszahlung", label: "Auszahlung" },
          { value: "all", label: "Alle Spalten" },
        ]}
      >
      <Card>
        <CardContent className="overflow-x-auto">
          <Table className="sx-datatable">
            <TableHeader>
              <TableRow>
                <TableHead data-column data-view-standard data-view-buchhaltung data-view-versand data-view-auszahlung data-view-all className="sx-sticky-0">Verkauf</TableHead>
                <TableHead data-column data-view-standard data-view-buchhaltung data-view-all>Datum</TableHead>
                <TableHead data-column data-view-standard data-view-versand data-view-all>Artikel</TableHead>
                <TableHead data-column data-view-standard data-view-all className="text-right">Menge</TableHead>
                <TableHead data-column data-view-standard data-view-buchhaltung data-view-auszahlung data-view-all className="text-right">VK brutto</TableHead>
                <TableHead data-column data-view-buchhaltung data-view-all className="text-right">Steuern</TableHead>
                <TableHead data-column data-view-buchhaltung data-view-all className="text-right">VK netto</TableHead>
                <TableHead data-column data-view-buchhaltung data-view-all className="text-right">EK netto</TableHead>
                <TableHead data-column data-view-buchhaltung data-view-all className="text-right">Gebühren</TableHead>
                <TableHead data-column data-view-buchhaltung data-view-all className="text-right">Versand</TableHead>
                <TableHead data-column data-view-standard data-view-buchhaltung data-view-all className="text-right">Gewinn</TableHead>
                <TableHead data-column data-view-buchhaltung data-view-all className="text-right">Marge</TableHead>
                <TableHead data-column data-view-standard data-view-versand data-view-auszahlung data-view-all>Plattform</TableHead>
                <TableHead data-column data-view-standard data-view-versand data-view-all>Status</TableHead>
                <TableHead data-column data-view-standard data-view-buchhaltung data-view-all>Rechnung</TableHead>
                <TableHead data-column data-view-versand data-view-all>Versandart</TableHead>
                <TableHead data-column data-view-versand data-view-all>Land</TableHead>
                <TableHead data-column data-view-standard data-view-auszahlung data-view-all>Auszahlung</TableHead>
                <TableHead data-column data-view-auszahlung data-view-all>Schuldstatus</TableHead>
                <TableHead data-column data-view-standard data-view-buchhaltung data-view-versand data-view-auszahlung data-view-all className="w-48 text-right">Aktionen</TableHead>
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
                <TableRow key={row.sale.id}>
                  <TableCell data-column data-view-standard data-view-buchhaltung data-view-versand data-view-auszahlung data-view-all className="sx-sticky-0 font-mono text-xs">
                    {row.sale.orderNumber ?? "–"}
                    {!row.hasNewLines && (
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Legacy
                      </div>
                    )}
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-buchhaltung data-view-all className="whitespace-nowrap">
                    {row.sale.soldAt.toLocaleDateString("de-DE")}
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-versand data-view-all className="sx-cell-primary max-w-96">
                    <div className="truncate font-medium">
                      {[...new Set(row.itemInfos.map((item) => item.model))].join(", ")}
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">
                      {row.itemInfos.map((item) => item.sku).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-all className="text-right">{row.sale.quantity}</TableCell>
                  <TableCell data-column data-view-standard data-view-buchhaltung data-view-auszahlung data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.salePriceCents)}
                  </TableCell>
                  <TableCell data-column data-view-buchhaltung data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.salePriceCents - row.sale.saleNetCents)}
                  </TableCell>
                  <TableCell data-column data-view-buchhaltung data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.saleNetCents)}
                  </TableCell>
                  <TableCell data-column data-view-buchhaltung data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.ekNetCents)}
                  </TableCell>
                  <TableCell data-column data-view-buchhaltung data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.platformFeeNetCents || row.sale.platformFeeCents)}
                  </TableCell>
                  <TableCell data-column data-view-buchhaltung data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.shippingCostCents)}
                  </TableCell>
                  <TableCell
                    data-column
                    data-view-standard
                    data-view-buchhaltung
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
                  <TableCell data-column data-view-buchhaltung data-view-all className="sx-cell-money text-right font-mono">
                    {formatEuro(row.sale.marginCents)}
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-versand data-view-auszahlung data-view-all>
                    <Badge variant="outline">{row.sale.platform.name}</Badge>
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-versand data-view-all>
                    <SaleStatusSelect saleId={row.sale.id} status={row.sale.status} />
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-buchhaltung data-view-all>
                    <InvoiceSelect saleId={row.sale.id} done={row.sale.invoiceCreated} />
                  </TableCell>
                  <TableCell data-column data-view-versand data-view-all>{row.sale.shippingMethod ?? "–"}</TableCell>
                  <TableCell data-column data-view-versand data-view-all>{row.sale.buyerCountry}</TableCell>
                  <TableCell data-column data-view-standard data-view-auszahlung data-view-all>{row.sale.payoutRecipient ?? "–"}</TableCell>
                  <TableCell data-column data-view-auszahlung data-view-all>
                    {row.sale.debtLinks.length
                      ? row.sale.debtLinks
                          .map((link) => `${link.debt.debtNumber ?? "SCH"} · ${link.debt.status}`)
                          .join(", ")
                      : "–"}
                  </TableCell>
                  <TableCell data-column data-view-standard data-view-buchhaltung data-view-versand data-view-auszahlung data-view-all>
                    <div className="flex justify-end gap-1">
                      <SaleDetailDrawer row={row} />
                      <SaleDialog
                        sale={toEditable(row)}
                        items={sellable}
                        platforms={platforms}
                        marketplaceAccounts={marketplaceAccounts.map((account) => ({ id: account.id, platformId: account.platformId, displayName: account.displayName, catalogVersion: account.defaultFeeSchedule?.version ?? null }))}
                        payoutOptions={payoutOptions}
                        shippingRates={rates}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Bearbeiten
                          </Button>
                        }
                      />
                      {row.hasNewLines && row.sale.status !== "CANCELLED" && (
                        <CancelSaleButton saleId={row.sale.id} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={3}>Summe ({rows.length} Verkäufe)</TableCell>
                  <TableCell className="text-right">{sum.qty}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(sum.gross)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      sum.profit < 0 ? "text-customs-red" : "text-transit-teal"
                    )}
                  >
                    {formatEuro(sum.profit)}
                  </TableCell>
                  <TableCell colSpan={5} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
