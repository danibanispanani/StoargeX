import Link from "next/link";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ProductTableQuery,
} from "@/lib/products/product-table";
import { DEFAULT_TABLE_PAGE_SIZE } from "@/lib/operational-table";

export function ProductFilterBar({
  query,
  categories,
  brands,
}: {
  query: ProductTableQuery;
  categories: string[];
  brands: string[];
}) {
  const hasFilters = Boolean(
    query.q || query.category || query.brand || query.from || query.to || query.preset !== "catalog"
  );

  return (
      <form
        method="GET"
        className="grid gap-2 sm:grid-cols-2 sm:items-end xl:grid-cols-3 min-[1360px]:grid-cols-[minmax(15rem,1fr)_repeat(2,minmax(9rem,0.45fr))_auto_auto_auto]"
      >
        <label className="relative min-w-0">
          <span className="sr-only">Produkte durchsuchen</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query.q}
            placeholder="Name, Variante, EAN, Kategorie oder Marke"
            className="pl-9"
          />
        </label>
        <FilterSelect name="category" label="Kategorie" value={query.category} options={categories} />
        <FilterSelect name="brand" label="Marke" value={query.brand} options={brands} />
        <label className="text-xs text-muted-foreground">
          Geändert von
          <Input name="from" type="date" defaultValue={query.from} className="mt-1 w-40" />
        </label>
        <label className="text-xs text-muted-foreground">
          bis
          <Input name="to" type="date" defaultValue={query.to} className="mt-1 w-40" />
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <input type="hidden" name="preset" value={query.preset} />
          <input type="hidden" name="sort" value={query.sort} />
          <input type="hidden" name="direction" value={query.direction} />
          {query.pageSize !== DEFAULT_TABLE_PAGE_SIZE ? <input type="hidden" name="pageSize" value={query.pageSize} /> : null}
          <Button type="submit" variant="secondary">Anwenden</Button>
          {hasFilters ? (
            <Button asChild variant="ghost" size="icon" title="Filter zurücksetzen">
              <Link href="/produkte" aria-label="Filter zurücksetzen"><XIcon /></Link>
            </Button>
          ) : null}
        </div>
      </form>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="border-input mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
      >
        <option value="">Alle</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
