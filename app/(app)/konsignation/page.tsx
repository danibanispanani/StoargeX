import { requireOrg } from "@/lib/org";
import { formatEuro, parseSurcharges } from "@/lib/calculations";
import { CreateConsignmentDialog } from "@/components/consignment/create-consignment-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { ConsignmentRowActions } from "@/components/consignment/consignment-row-actions";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ConsignmentPage() {
  const { db } = await requireOrg();

  const [items, recentSales] = await Promise.all([
    db.consignmentInventory.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.sale.findMany({
      include: { stockItem: { select: { title: true } } },
      orderBy: { soldAt: "desc" },
      take: 500,
    }),
  ]);

  // Umsatz/Marge separat auswertbar: verknüpfte Sales je Artikel aggregieren
  const allLinkedIds = [...new Set(items.flatMap((i) => i.linkedSaleIds))];
  const linkedSales = allLinkedIds.length
    ? await db.sale.findMany({
        where: { id: { in: allLinkedIds } },
        select: { id: true, salePriceCents: true, profitCents: true },
      })
    : [];
  const saleById = new Map(linkedSales.map((s) => [s.id, s]));

  const rows = items.map((item) => {
    const linked = item.linkedSaleIds
      .map((id) => saleById.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    return {
      item,
      priceTiers: parseSurcharges(item.priceTiers),
      linkedCount: linked.length,
      revenueCents: linked.reduce((sum, s) => sum + s.salePriceCents, 0),
      profitCents: linked.reduce((sum, s) => sum + s.profitCents, 0),
    };
  });

  const saleOptions = recentSales.map((s) => ({
    id: s.id,
    label: `${s.orderNumber ?? s.id.slice(0, 8)} – ${s.stockItem?.title ?? "Mehrartikel-Verkauf"} (${formatEuro(s.salePriceCents)})`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Konsignation</h1>
          <p className="text-sm text-muted-foreground">
            Fremdfirmen-Ware mit eigener SKU – Umsatz und Marge über verknüpfte
            Verkäufe separat auswertbar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ImportExportBar table="konsignation" />
          <CreateConsignmentDialog />
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Partnerfirma</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead className="text-right">Bestand</TableHead>
                <TableHead className="text-right">Verkauft</TableHead>
                <TableHead className="text-right">Retour</TableHead>
                <TableHead className="text-right">Defekt</TableHead>
                <TableHead>Preisebenen</TableHead>
                <TableHead className="text-right">Umsatz / Marge</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    Noch keine Konsignationsware erfasst. Lege über
                    „Konsignationsartikel anlegen&ldquo; Ware von Partnerfirmen mit
                    eigener SKU, Beständen und Preisebenen an.
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ item, priceTiers, linkedCount, revenueCents, profitCents }) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell>{item.consignorName}</TableCell>
                  <TableCell className="max-w-56 truncate font-medium">
                    {item.itemTitle}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.soldQuantity}</TableCell>
                  <TableCell className="text-right">{item.returnedQuantity}</TableCell>
                  <TableCell className="text-right">{item.defectiveQuantity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {priceTiers.length
                      ? priceTiers
                          .map((t) => `${t.label}: ${formatEuro(t.cents)}`)
                          .join(" · ")
                      : "–"}
                  </TableCell>
                  <TableCell className="text-right">
                    {linkedCount > 0 ? (
                      <>
                        <div>{formatEuro(revenueCents)}</div>
                        <div className="text-xs text-muted-foreground">
                          Marge {formatEuro(profitCents)} ({linkedCount} Verkäufe)
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        keine Verkäufe verknüpft
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ConsignmentRowActions
                      item={{
                        id: item.id,
                        sku: item.sku,
                        quantity: item.quantity,
                        soldQuantity: item.soldQuantity,
                        returnedQuantity: item.returnedQuantity,
                        defectiveQuantity: item.defectiveQuantity,
                        linkedSaleIds: item.linkedSaleIds,
                      }}
                      saleOptions={saleOptions}
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
