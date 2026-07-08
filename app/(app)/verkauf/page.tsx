import type { Prisma } from "@prisma/client";
import { requireOrg } from "@/lib/org";
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
  const { db, organization } = await requireOrg();
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

  const [sales, platforms, payoutOptions, rates, sellablePositions] =
    await Promise.all([
      db.sale.findMany({
        where,
        include: {
          platform: { select: { name: true } },
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
        },
        include: {
          product: true,
          consignmentLot: true,
        },
        orderBy: [{ inventoryType: "asc" }, { receivedAt: "asc" }],
        take: 500,
      }),
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Verkauf</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} Verkäufe {Object.values(params).some(Boolean) ? "(gefiltert)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ImportExportBar table="verkauf" />
          <SaleDialog
            items={sellable}
            platforms={platforms}
            payoutOptions={payoutOptions}
            shippingRates={rates}
          />
        </div>
      </div>

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

      <Card>
        <CardContent className="overflow-x-auto">
          <Table className="sx-datatable">
            <TableHeader>
              <TableRow>
                <TableHead className="sx-sticky-0">Verkauf</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead className="text-right">VK brutto</TableHead>
                <TableHead className="text-right">Gewinn</TableHead>
                <TableHead>Plattform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rechnung</TableHead>
                <TableHead>Auszahlung</TableHead>
                <TableHead className="w-40 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                    Keine Verkäufe gefunden.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.sale.id}>
                  <TableCell className="sx-sticky-0 font-mono text-xs">
                    {row.sale.orderNumber ?? "–"}
                    {!row.hasNewLines && (
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Legacy
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.sale.soldAt.toLocaleDateString("de-DE")}
                  </TableCell>
                  <TableCell className="max-w-96">
                    <div className="truncate font-medium">
                      {[...new Set(row.itemInfos.map((item) => item.model))].join(", ")}
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">
                      {row.itemInfos.map((item) => item.sku).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{row.sale.quantity}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEuro(row.sale.salePriceCents)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono font-medium",
                      row.sale.profitCents < 0
                        ? "text-customs-red"
                        : "text-transit-teal"
                    )}
                  >
                    {formatEuro(row.sale.profitCents)}
                    <div className="text-xs font-normal text-muted-foreground">
                      EK {formatEuro(row.ekNetCents)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.sale.platform.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <SaleStatusSelect saleId={row.sale.id} status={row.sale.status} />
                  </TableCell>
                  <TableCell>
                    <InvoiceSelect saleId={row.sale.id} done={row.sale.invoiceCreated} />
                  </TableCell>
                  <TableCell>{row.sale.payoutRecipient ?? "–"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <SaleDialog
                        sale={toEditable(row)}
                        items={sellable}
                        platforms={platforms}
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
    </div>
  );
}
