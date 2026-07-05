"use client";

import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PickerProduct {
  id: string;
  name: string;
  variant: string | null;
  ean: string | null;
  category: string | null;
  defaultPriceCents: number | null;
}

/**
 * Durchsuchbares Produkt-Dropdown: filtert den Katalog nach Name/Variante/
 * EAN und befüllt bei Auswahl die Formularfelder (überschreibbar).
 */
export function ProductPicker({
  products,
  onSelect,
}: {
  products: PickerProduct[];
  onSelect: (product: PickerProduct) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter((p) =>
        [p.name, p.variant, p.ean, p.category]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [products, query]);

  if (products.length === 0) return null;

  return (
    <div className="relative space-y-2">
      <Label htmlFor="product-picker">Aus Produktkatalog übernehmen (optional)</Label>
      <Input
        id="product-picker"
        value={query}
        placeholder="Katalog durchsuchen: Name, Variante, EAN…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {matches.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  onSelect(product);
                  setQuery(
                    product.variant
                      ? `${product.name} (${product.variant})`
                      : product.name
                  );
                  setOpen(false);
                }}
              >
                <span className="font-medium">{product.name}</span>
                {product.variant && (
                  <span className="text-muted-foreground"> · {product.variant}</span>
                )}
                {product.ean && (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {product.ean}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
