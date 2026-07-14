import Link from "next/link";
import { SearchIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PRODUCT_TABLE_DEFINITION,
  productQueryToSearchParams,
  type ProductTableQuery,
} from "@/lib/products/product-table";
import { cn } from "@/lib/utils";

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
    <div className="space-y-2">
      <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Produktansichten">
        {PRODUCT_TABLE_DEFINITION.presets.map((preset) => {
          const params = productQueryToSearchParams({ ...query, preset: preset.key, page: 1 });
          if (preset.key === "catalog") params.delete("preset");
          return (
            <Link
              key={preset.key}
              href={`/produkte${params.size ? `?${params}` : ""}`}
              aria-current={query.preset === preset.key ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: query.preset === preset.key ? "secondary" : "ghost", size: "sm" }),
                "shrink-0"
              )}
            >
              {preset.label}
            </Link>
          );
        })}
      </nav>

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
          <select
            name="pageSize"
            defaultValue={String(query.pageSize)}
            aria-label="Treffer pro Seite"
            className="border-input h-9 rounded-md border bg-background px-2 text-sm"
          >
            {PRODUCT_TABLE_DEFINITION.pageSizes.map((size) => (
              <option key={size} value={size}>{size} / Seite</option>
            ))}
          </select>
          <Button type="submit" variant="secondary">Anwenden</Button>
          {hasFilters ? (
            <Button asChild variant="ghost" size="icon" title="Filter zurücksetzen">
              <Link href="/produkte" aria-label="Filter zurücksetzen"><XIcon /></Link>
            </Button>
          ) : null}
        </div>
      </form>
    </div>
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
