"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageSearchIcon, TagsIcon } from "lucide-react";
import { toast } from "sonner";
import { bulkCategorizeProductsAction } from "@/lib/actions/products";
import { formatEuro } from "@/lib/calculations";
import type { TablePreferenceScope, TableSelection } from "@/lib/operational-table";
import {
  PRODUCT_TABLE_DEFINITION,
  type ProductSortKey,
  type ProductTableQuery,
} from "@/lib/products/product-table";
import { EmptyState } from "@/components/app/states";
import { ProductDialog } from "@/components/products/product-dialog";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmActionDialog } from "@/components/table/confirm-action-dialog";
import { DetailDrawer, DetailGrid, DetailSection } from "@/components/table/detail-drawer";
import { OperationalPagination } from "@/components/table/operational-pagination";
import {
  OperationalTableWorkspace,
  TableSelectionCheckbox,
} from "@/components/table/operational-table-workspace";
import { TableSortHeader } from "@/components/table/table-sort-header";

export interface ProductOperationalRow {
  id: string;
  name: string;
  variant: string;
  brand: string;
  category: string;
  ean: string;
  size: string;
  defaultPriceCents: number | null;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
  usage: {
    purchases: number;
    inventory: number;
    sales: number;
  };
}

const columns = PRODUCT_TABLE_DEFINITION.columns.map((column) => ({
  key: column.key,
  label: column.label,
  required: column.key === "name",
}));
const defaultVisibleColumns = PRODUCT_TABLE_DEFINITION.columns
  .filter((column) => column.defaultVisible)
  .map((column) => column.key);

export function ProductTable({
  rows,
  totalResults,
  query,
  queryString,
  allResultDigest,
  scope,
  categories,
}: {
  rows: ProductOperationalRow[];
  totalResults: number;
  query: ProductTableQuery;
  queryString: string;
  allResultDigest: string | null;
  scope: TablePreferenceScope;
  categories: string[];
}) {
  return (
    <div className="overflow-hidden border bg-card shadow-xs">
      <OperationalTableWorkspace
        scope={scope}
        basePath={PRODUCT_TABLE_DEFINITION.path}
        columns={columns}
        defaultVisibleColumns={defaultVisibleColumns}
        pageRowIds={rows.map((row) => row.id)}
        totalResults={totalResults}
        currentQuery={queryString}
        renderBulkActions={(selection, count, clearSelection) => (
          <BulkCategoryDialog
            selection={selection}
            selectedCount={count}
            queryString={queryString}
            allResultDigest={allResultDigest}
            categories={categories}
            clearSelection={clearSelection}
          />
        )}
        renderTable={(state) => {
          const visibleCount = state.visibleColumns.size + 2;
          return (
            <>
              <Table className="sx-datatable min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sx-sticky-0 w-10">
                      <TableSelectionCheckbox
                        checked={state.pageSelection}
                        onCheckedChange={state.togglePage}
                        label="Alle Produkte auf dieser Seite auswählen"
                      />
                    </TableHead>
                    {state.visibleColumns.has("name") ? (
                      <TableHead className="sx-sticky-1 min-w-64">
                        <TableSortHeader label="Produkt" column="name" currentSort={query.sort} direction={query.direction} query={queryString} />
                      </TableHead>
                    ) : null}
                    {state.visibleColumns.has("variant") ? <SortableHead label="Variante" column="variant" query={query} queryString={queryString} /> : null}
                    {state.visibleColumns.has("category") ? <SortableHead label="Kategorie" column="category" query={query} queryString={queryString} /> : null}
                    {state.visibleColumns.has("brand") ? <SortableHead label="Marke" column="brand" query={query} queryString={queryString} /> : null}
                    {state.visibleColumns.has("usage") ? <TableHead>Nutzung</TableHead> : null}
                    {state.visibleColumns.has("ean") ? <SortableHead label="EAN" column="ean" query={query} queryString={queryString} /> : null}
                    {state.visibleColumns.has("defaultPrice") ? <SortableHead label="Standard-EK" column="defaultPrice" query={query} queryString={queryString} className="text-right" /> : null}
                    {state.visibleColumns.has("size") ? <SortableHead label="Größe" column="size" query={query} queryString={queryString} /> : null}
                    {state.visibleColumns.has("images") ? <TableHead>Bilder</TableHead> : null}
                    {state.visibleColumns.has("updatedAt") ? <SortableHead label="Geändert" column="updatedAt" query={query} queryString={queryString} /> : null}
                    <TableHead className="w-64">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleCount} className="p-0 whitespace-normal">
                        <EmptyState
                          title="Keine Produkte in dieser Ansicht"
                          description="Passe Suche oder Filter an – oder lege das erste Katalogprodukt an."
                        />
                      </TableCell>
                    </TableRow>
                  ) : rows.map((row) => {
                    const selected = state.isSelected(row.id);
                    return (
                      <TableRow key={row.id} data-state={selected ? "selected" : undefined} data-selected={selected}>
                        <TableCell className="sx-sticky-0">
                          <TableSelectionCheckbox
                            checked={selected}
                            onCheckedChange={() => state.toggleRow(row.id)}
                            label={`${row.name} auswählen`}
                          />
                        </TableCell>
                        {state.visibleColumns.has("name") ? (
                          <TableCell className="sx-sticky-1 sx-cell-primary">
                            <div className="flex items-center gap-2">
                              {row.imageUrls[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={row.imageUrls[0]} alt="" className="size-8 shrink-0 rounded object-cover" />
                              ) : (
                                <span className="grid size-8 shrink-0 place-items-center rounded border bg-muted text-muted-foreground"><PackageSearchIcon className="size-4" /></span>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-foreground">{row.name}</div>
                                <div className="truncate text-xs text-muted-foreground sm:hidden">{row.variant || row.brand || "Ohne Variante"}</div>
                              </div>
                            </div>
                          </TableCell>
                        ) : null}
                        {state.visibleColumns.has("variant") ? <TableCell>{row.variant || "–"}</TableCell> : null}
                        {state.visibleColumns.has("category") ? <TableCell>{row.category || "–"}</TableCell> : null}
                        {state.visibleColumns.has("brand") ? <TableCell>{row.brand || "–"}</TableCell> : null}
                        {state.visibleColumns.has("usage") ? (
                          <TableCell className="font-mono text-xs">
                            {row.usage.inventory} Lager · {row.usage.purchases} EK · {row.usage.sales} VK
                          </TableCell>
                        ) : null}
                        {state.visibleColumns.has("ean") ? <TableCell className="font-mono text-xs">{row.ean || "–"}</TableCell> : null}
                        {state.visibleColumns.has("defaultPrice") ? <TableCell className="text-right font-mono">{row.defaultPriceCents == null ? "–" : formatEuro(row.defaultPriceCents)}</TableCell> : null}
                        {state.visibleColumns.has("size") ? <TableCell>{row.size || "–"}</TableCell> : null}
                        {state.visibleColumns.has("images") ? <TableCell>{row.imageUrls.length}</TableCell> : null}
                        {state.visibleColumns.has("updatedAt") ? <TableCell className="whitespace-nowrap">{formatDate(row.updatedAt)}</TableCell> : null}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <ProductDetail row={row} />
                            <ProductDialog product={{
                              id: row.id,
                              name: row.name,
                              variant: row.variant,
                              brand: row.brand,
                              category: row.category,
                              ean: row.ean,
                              size: row.size,
                              defaultPriceCents: row.defaultPriceCents,
                            }} />
                            <DeleteProductButton productId={row.id} name={row.name} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <OperationalPagination page={query.page} pageSize={query.pageSize} totalResults={totalResults} query={queryString} />
            </>
          );
        }}
      />
    </div>
  );
}

function SortableHead({ label, column, query, queryString, className }: { label: string; column: ProductSortKey; query: ProductTableQuery; queryString: string; className?: string }) {
  return <TableHead className={className}><TableSortHeader label={label} column={column} currentSort={query.sort} direction={query.direction} query={queryString} /></TableHead>;
}

function ProductDetail({ row }: { row: ProductOperationalRow }) {
  return (
    <DetailDrawer title={row.name} description="Katalogdaten und aktuelle Verwendung" triggerLabel="Details">
      <DetailSection title="Stammdaten">
        <DetailGrid items={[
          { label: "Variante", value: row.variant || "–" },
          { label: "Marke", value: row.brand || "–" },
          { label: "Kategorie", value: row.category || "–" },
          { label: "Größe", value: row.size || "–" },
          { label: "EAN", value: row.ean || "–" },
          { label: "Standard-EK", value: row.defaultPriceCents == null ? "–" : formatEuro(row.defaultPriceCents) },
        ]} />
      </DetailSection>
      <DetailSection title="Verwendung">
        <DetailGrid items={[
          { label: "Einkaufspositionen", value: row.usage.purchases },
          { label: "Lagerpositionen", value: row.usage.inventory },
          { label: "Verkaufspositionen", value: row.usage.sales },
          { label: "Bilder", value: row.imageUrls.length },
        ]} />
      </DetailSection>
      <DetailSection title="Historie">
        <DetailGrid items={[
          { label: "Angelegt", value: formatDateTime(row.createdAt) },
          { label: "Zuletzt geändert", value: formatDateTime(row.updatedAt) },
        ]} />
      </DetailSection>
    </DetailDrawer>
  );
}

function BulkCategoryDialog({ selection, selectedCount, queryString, allResultDigest, categories, clearSelection }: { selection: TableSelection; selectedCount: number; queryString: string; allResultDigest: string | null; categories: string[]; clearSelection: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const result = await bulkCategorizeProductsAction({
          category,
          expectedCount: selectedCount,
          expectedResultDigest: selection.mode === "all" ? allResultDigest ?? undefined : undefined,
          selection,
          query: Object.fromEntries(new URLSearchParams(queryString)),
        });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        if (result?.success) toast.success(result.success);
        setOpen(false);
        setCategory("");
        clearSelection();
        router.refresh();
      } catch {
        toast.error("Die Kategorie konnte nicht zugeordnet werden.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger asChild><Button size="sm" variant="secondary"><TagsIcon /> Kategorie zuordnen</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{selectedCount} Produkte kategorisieren</DialogTitle>
          <DialogDescription>Nur die serverseitig erneut geprüfte Treffermenge wird geändert.</DialogDescription>
        </DialogHeader>
        <Input value={category} onChange={(event) => setCategory(event.target.value)} list="product-category-options" placeholder="Kategorie" maxLength={100} />
        <datalist id="product-category-options">{categories.map((item) => <option key={item} value={item} />)}</datalist>
        <ConfirmActionDialog
          trigger={<Button className="w-full" disabled={pending || !category.trim()}>{pending ? "Wird zugeordnet…" : "Zuordnung prüfen"}</Button>}
          title="Kategorie wirklich zuordnen?"
          description={`${selectedCount} ausgewählte Produkte erhalten die Kategorie „${category.trim()}“. Bestands- und Belegdaten bleiben unverändert.`}
          confirmLabel="Kategorie zuordnen"
          onConfirm={run}
          disabled={pending || !category.trim()}
        />
      </DialogContent>
    </Dialog>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE");
}
