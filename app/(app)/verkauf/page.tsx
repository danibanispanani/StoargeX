import type { Prisma } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { getOptions } from "@/lib/options";
import { formatEuro } from "@/lib/calculations";
import { SaleDialog, type EditableSale, type SellableItem } from "@/components/sales/sale-dialog";
import { SaleFilterBar } from "@/components/sales/sale-filter-bar";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { InvoiceSelect, SaleStatusSelect } from "@/components/sales/sale-inline-selects";
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
            {
              items: {
                some: {
                  consignment: {
                    OR: [
                      { itemTitle: { contains: params.q, mode: "insensitive" as const } },
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

  const [sales, platforms, payoutOptions, rates, stockItems, consignments] =
    await Promise.all([
      db.sale.findMany({
        where,
        include: {
          platform: { select: { name: true } },
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
      db.stockItem.findMany({
        where: { status: { notIn: ["SOLD", "CANCELLED", "WRITTEN_OFF"] } },
        orderBy: { sku: "desc" },
        select: { id: true, sku: true, title: true, variant: true, size: true },
        take: 500,
      }),
      db.consignmentInventory.findMany({
        where: { quantity: { gt: 0 } },
        orderBy: { sku: "desc" },
        select: { id: true, sku: true, itemTitle: true },
        take: 500,
      }),
    ]);

  const sellable: SellableItem[] = [
    ...stockItems.map((item) => ({
      ref: `stock:${item.id}`,
      label: [item.sku, item.title, item.variant, item.size]
        .filter(Boolean)
        .join(" · "),
      source: "Lager" as const,
    })),
    ...consignments.map((c) => ({
      ref: `consignment:${c.id}`,
      label: `${c.sku} · ${c.itemTitle}`,
      source: "Konsignation" as const,
    })),
  ];

  const rows = sales.map((sale) => {
    const itemInfos = sale.items.map((item) =>
      item.stockItem
        ? {
            sku: item.stockItem.sku,
            model: item.stockItem.title,
            variant: item.stockItem.variant ?? "",
            size: item.stockItem.size ?? "",
          }
        : {
            sku: item.consignment?.sku ?? "?",
            model: item.consignment?.itemTitle ?? "?",
            variant: "",
            size: "",
          }
    );
    const ekNetCents = sale.items.reduce((sum, i) => sum + i.ekNetCents, 0);
    const taxCents = sale.salePriceCents - sale.saleNetCents;
    const marginPercent =
      sale.saleNetCents > 0 ? (sale.profitCents / sale.saleNetCents) * 100 : 0;
    return { sale, itemInfos, ekNetCents, taxCents, marginPercent };
  });

  const sum = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.sale.salePriceCents,
      tax: acc.tax + r.taxCents,
      net: acc.net + r.sale.saleNetCents,
      ek: acc.ek + r.ekNetCents,
      feeGross: acc.feeGross + r.sale.platformFeeCents,
      feeNet: acc.feeNet + r.sale.platformFeeNetCents,
      shipping: acc.shipping + r.sale.shippingCostCents,
      profit: acc.profit + r.sale.profitCents,
      qty: acc.qty + r.sale.quantity,
    }),
    { gross: 0, tax: 0, net: 0, ek: 0, feeGross: 0, feeNet: 0, shipping: 0, profit: 0, qty: 0 }
  );

  const shippingMethodOptions = [
    ...new Set([
      ...rates.map((r) => `${r.carrierName} ${r.name}`),
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
      itemLabels: row.itemInfos.map((i) => `${i.sku} ${i.model}`),
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
                <TableHead className="sx-sticky-0">OrderID</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>LagerID(s)</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Colorway/Version</TableHead>
                <TableHead>Größe</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead className="text-right">VK brutto</TableHead>
                <TableHead className="text-right">Steuern</TableHead>
                <TableHead className="text-right">VK netto</TableHead>
                <TableHead className="text-right">EK netto</TableHead>
                <TableHead className="text-right">PF-Geb. brutto</TableHead>
                <TableHead className="text-right">PF-Geb. netto</TableHead>
                <TableHead className="text-right">Versand netto</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Gewinn</TableHead>
                <TableHead>Gesamtstatus</TableHead>
                <TableHead>Rechnung</TableHead>
                <TableHead>Plattform</TableHead>
                <TableHead>Versandart</TableHead>
                <TableHead>Land</TableHead>
                <TableHead>Auszahlung</TableHead>
                <TableHead>Kommentar</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={24} className="py-8 text-center text-muted-foreground">
                    Keine Verkäufe gefunden. Über „Verkauf erfassen&ldquo;
                    verknüpfst du einen oder mehrere Artikel aus Lager und
                    Konsignation mit einem Verkauf.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.sale.id}>
                  <TableCell className="sx-sticky-0 font-mono text-xs">
                    {row.sale.orderNumber ?? "–"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.sale.soldAt.toLocaleDateString("de-DE")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.itemInfos.map((i) => i.sku).join(", ")}
                  </TableCell>
                  <TableCell className="max-w-44 truncate font-medium">
                    {[...new Set(row.itemInfos.map((i) => i.model))].join(", ")}
                  </TableCell>
                  <TableCell className="max-w-32 truncate">
                    {[...new Set(row.itemInfos.map((i) => i.variant).filter(Boolean))].join(", ") || "–"}
                  </TableCell>
                  <TableCell>
                    {[...new Set(row.itemInfos.map((i) => i.size).filter(Boolean))].join(", ") || "–"}
                  </TableCell>
                  <TableCell className="text-right">{row.sale.quantity}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEuro(row.sale.salePriceCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEuro(row.taxCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEuro(row.sale.saleNetCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEuro(row.ekNetCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEuro(row.sale.platformFeeCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEuro(row.sale.platformFeeNetCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEuro(row.sale.shippingCostCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.marginPercent.toFixed(1).replace(".", ",")} %
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
                  </TableCell>
                  <TableCell>
                    <SaleStatusSelect saleId={row.sale.id} status={row.sale.status} />
                  </TableCell>
                  <TableCell>
                    <InvoiceSelect saleId={row.sale.id} done={row.sale.invoiceCreated} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.sale.platform.name}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.sale.shippingMethod ?? "–"}
                  </TableCell>
                  <TableCell>{row.sale.buyerCountry}</TableCell>
                  <TableCell>{row.sale.payoutRecipient ?? "–"}</TableCell>
                  <TableCell className="max-w-36 truncate">
                    {row.sale.notes ?? "–"}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={6}>Summe ({rows.length} Verkäufe)</TableCell>
                  <TableCell className="text-right">{sum.qty}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(sum.gross)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(sum.tax)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(sum.net)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(sum.ek)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(sum.feeGross)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(sum.feeNet)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(sum.shipping)}</TableCell>
                  <TableCell />
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      sum.profit < 0 ? "text-customs-red" : "text-transit-teal"
                    )}
                  >
                    {formatEuro(sum.profit)}
                  </TableCell>
                  <TableCell colSpan={8} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
