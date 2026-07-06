"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createStockItemAction,
  updateStockItemAction,
} from "@/lib/actions/stock";
import type { ActionState } from "@/lib/actions/team";
import {
  ENTRY_STATUS_TITLES,
  KAUF_STATUS_OPTIONS,
  RETOURE_STATUS_OPTIONS,
  STOCK_STATUS,
  STOCK_STATUS_OPTIONS,
} from "@/lib/constants";
import { ProductPicker, type PickerProduct } from "@/components/products/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface EditableStockItem {
  id: string;
  sku: string;
  purchaseDate: string; // yyyy-mm-dd
  supplier: string;
  title: string;
  variant: string;
  size: string;
  priceGross: string; // "12,34"
  inputTaxDeductible: boolean;
  paymentMethod: string;
  kaufStatus: string;
  retoureStatus: string;
  status: string;
  ean: string;
  notes: string;
  platformIds: string[];
}

export function StockItemDialog({
  item,
  platforms,
  zmOptions,
  products = [],
  trigger,
}: {
  item?: EditableStockItem;
  platforms: Array<{ id: string; name: string }>;
  zmOptions: string[];
  products?: PickerProduct[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [deductible, setDeductible] = useState(item?.inputTaxDeductible ?? false);
  // Prefill-Felder (Produktkatalog) – überschreibbar
  const [title, setTitle] = useState(item?.title ?? "");
  const [variant, setVariant] = useState(item?.variant ?? "");
  const [ean, setEan] = useState(item?.ean ?? "");
  const [price, setPrice] = useState(item?.priceGross ?? "");

  const action = item
    ? updateStockItemAction.bind(null, item.id)
    : createStockItemAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      if (!item) {
        setTitle("");
        setVariant("");
        setEan("");
        setPrice("");
        setDeductible(false);
      }
    }
  }, [state, item]);

  function applyProduct(product: PickerProduct) {
    setTitle(product.name);
    setVariant(product.variant ?? "");
    setEan(product.ean ?? "");
    if (product.defaultPriceCents != null) {
      setPrice((product.defaultPriceCents / 100).toFixed(2).replace(".", ","));
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? <Button>Wareneingang erfassen</Button>}
      </SheetTrigger>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {item ? `Artikel ${item.sku} bearbeiten` : "Wareneingang erfassen"}
          </SheetTitle>
          <SheetDescription>
            {item
              ? "Alle Felder sind nachträglich änderbar."
              : "Netto wird bei Vorsteuerabzug automatisch berechnet. Menge > 1 erzeugt separate Einträge mit fortlaufenden LagerIDs."}
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {!item && products.length > 0 && (
            <ProductPicker products={products} onSelect={applyProduct} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="si-date">Datum *</Label>
              <Input
                id="si-date"
                name="purchaseDate"
                type="date"
                defaultValue={item?.purchaseDate ?? today}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-supplier">Händler</Label>
              <Input
                id="si-supplier"
                name="supplier"
                defaultValue={item?.supplier}
                placeholder="z.B. MediaMarkt, Amazon, privat"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-title">Model *</Label>
              <Input
                id="si-title"
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Amazon Fire TV Stick"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-variant">Colorway/Version</Label>
              <Input
                id="si-variant"
                name="variant"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder="z.B. 4K Max, Schwarz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-size">Size</Label>
              <Input
                id="si-size"
                name="size"
                defaultValue={item?.size}
                placeholder="z.B. XL, 42, One Size"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-price">Brutto (€) *</Label>
              <Input
                id="si-price"
                name="priceGross"
                required
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="z.B. 34,99"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-ean">EAN</Label>
              <Input
                id="si-ean"
                name="ean"
                inputMode="numeric"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                placeholder="z.B. 840080588582"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-zm">Zahlungsmethode (ZM) *</Label>
              <select
                id="si-zm"
                name="paymentMethod"
                required
                defaultValue={item?.paymentMethod ?? zmOptions[0] ?? ""}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {zmOptions.map((zm) => (
                  <option key={zm} value={zm}>
                    {zm}
                  </option>
                ))}
              </select>
              {!item && (
                <p className="text-xs text-muted-foreground">
                  Richard/Daniel erzeugen automatisch einen Schulden-Eintrag.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="inputTaxDeductible"
                checked={deductible}
                onChange={(e) => setDeductible(e.target.checked)}
                className="size-4"
              />
              VST – vorsteuerabzugsfähig (Netto wird berechnet)
            </label>
            {deductible && (
              <label className="flex items-center gap-2 text-sm">
                USt-Satz:
                <select
                  name="inputTaxRatePercent"
                  defaultValue="19"
                  className="border-input h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="19">19 %</option>
                  <option value="7">7 %</option>
                </select>
              </label>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="si-status">Status</Label>
              <select
                id="si-status"
                name="status"
                defaultValue={item?.status ?? "IN_STOCK"}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {STOCK_STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {STOCK_STATUS[value].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-kauf">Kauf</Label>
              <select
                id="si-kauf"
                name="kaufStatus"
                defaultValue={item?.kaufStatus ?? "O"}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {KAUF_STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} – {ENTRY_STATUS_TITLES[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-retoure">Retoure</Label>
              <select
                id="si-retoure"
                name="retoureStatus"
                defaultValue={item?.retoureStatus ?? "NN"}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {RETOURE_STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} – {ENTRY_STATUS_TITLES[value]}
                  </option>
                ))}
              </select>
            </div>
            {!item && (
              <div className="space-y-2">
                <Label htmlFor="si-qty">Menge</Label>
                <Input id="si-qty" name="quantity" type="number" min={1} max={500} defaultValue={1} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Gelistet auf</Label>
            <div className="flex flex-wrap gap-3 rounded-md border p-3">
              {platforms.map((platform) => (
                <label key={platform.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="platformIds"
                    value={platform.id}
                    defaultChecked={item?.platformIds.includes(platform.id)}
                    className="size-4"
                  />
                  {platform.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="si-image">Bild (JPG/PNG/WebP, max. 5 MB)</Label>
              <Input id="si-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-notes">Notizen</Label>
              <Input id="si-notes" name="notes" defaultValue={item?.notes} placeholder="optional" />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert…" : item ? "Änderungen speichern" : "Artikel eintragen"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
