import { requireOrg } from "@/lib/org";
import { getOptions } from "@/lib/options";
import { EntryStatus, StockItemStatus } from "@prisma/client";
import { StockItemDialog } from "@/components/stock/stock-item-dialog";
import { StockFilterBar } from "@/components/stock/stock-filter-bar";
import { StockTable, type StockRow } from "@/components/stock/stock-table";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    kauf?: string;
    retoure?: string;
    zm?: string;
    plattform?: string;
    von?: string;
    bis?: string;
  }>;
}) {
  const { db, organization } = await requireOrg();
  const params = await searchParams;

  const statusFilter =
    params.status && params.status in StockItemStatus
      ? (params.status as StockItemStatus)
      : undefined;
  const kaufFilter =
    params.kauf && params.kauf in EntryStatus ? (params.kauf as EntryStatus) : undefined;
  const retoureFilter =
    params.retoure && params.retoure in EntryStatus
      ? (params.retoure as EntryStatus)
      : undefined;

  const [items, platforms, zmOptions, products] = await Promise.all([
    db.stockItem.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(kaufFilter ? { kaufStatus: kaufFilter } : {}),
        ...(retoureFilter ? { retoureStatus: retoureFilter } : {}),
        ...(params.zm ? { paymentMethod: params.zm } : {}),
        ...(params.plattform
          ? { listings: { some: { platformId: params.plattform } } }
          : {}),
        ...(params.von || params.bis
          ? {
              purchaseDate: {
                ...(params.von ? { gte: new Date(params.von) } : {}),
                ...(params.bis ? { lte: new Date(`${params.bis}T23:59:59`) } : {}),
              },
            }
          : {}),
        ...(params.q
          ? {
              OR: [
                { title: { contains: params.q, mode: "insensitive" } },
                { variant: { contains: params.q, mode: "insensitive" } },
                { sku: { contains: params.q, mode: "insensitive" } },
                { ean: { contains: params.q } },
                { supplier: { contains: params.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { listings: { select: { platformId: true } } },
      orderBy: { sku: "desc" },
      take: 500,
    }),
    db.platform.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getOptions(db, organization.id, "PAYMENT_METHOD"),
    db.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        variant: true,
        ean: true,
        category: true,
        defaultPriceCents: true,
      },
      take: 500,
    }),
  ]);

  const rows: StockRow[] = items.map((item) => ({
    id: item.id,
    sku: item.sku,
    date: item.purchaseDate?.toLocaleDateString("de-DE") ?? "–",
    dateIso: item.purchaseDate?.toISOString().slice(0, 10) ?? "",
    supplier: item.supplier ?? "",
    title: item.title,
    variant: item.variant ?? "",
    size: item.size ?? "",
    grossCents: item.purchasePriceCents,
    netCents: item.purchaseNetCents,
    inputTaxDeductible: item.inputTaxDeductible,
    zm: item.paymentMethod ?? "",
    kaufStatus: item.kaufStatus,
    retoureStatus: item.retoureStatus,
    status: item.status,
    ean: item.ean ?? "",
    imageUrl: item.imageUrls[0] ?? null,
    listings: item.listings.map((l) => l.platformId),
    notes: item.notes ?? "",
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Lager</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} Einheit(en){" "}
            {Object.values(params).some(Boolean) ? "(gefiltert)" : ""}
          </p>
        </div>
        <StockItemDialog
          platforms={platforms}
          zmOptions={zmOptions}
          products={products}
        />
      </div>

      <StockFilterBar
        filters={{
          q: params.q ?? "",
          status: params.status ?? "",
          kauf: params.kauf ?? "",
          retoure: params.retoure ?? "",
          zm: params.zm ?? "",
          plattform: params.plattform ?? "",
          von: params.von ?? "",
          bis: params.bis ?? "",
        }}
        platforms={platforms}
        zmOptions={zmOptions}
      />

      <StockTable
        rows={rows}
        platforms={platforms}
        zmOptions={zmOptions}
        products={products}
      />
    </div>
  );
}
