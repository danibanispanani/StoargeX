"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createStockItemAction } from "@/lib/actions/stock";
import type { ActionState } from "@/lib/actions/team";
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

export function StockItemDialog({
  platforms,
  zmOptions,
  products = [],
}: {
  platforms: Array<{ id: string; name: string }>;
  zmOptions: string[];
  products?: PickerProduct[];
}) {
  const [open, setOpen] = useState(false);
  const [deductible, setDeductible] = useState(false);
  // Prefill-Felder (Produktkatalog) – überschreibbar
  const [title, setTitle] = useState("");
  const [variant, setVariant] = useState("");
  const [size, setSize] = useState("");
  const [ean, setEan] = useState("");
  const [price, setPrice] = useState("");
  const [productId, setProductId] = useState("");

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createStockItemAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      setTitle("");
      setVariant("");
      setSize("");
      setEan("");
      setPrice("");
      setProductId("");
      setDeductible(false);
    }
  }, [state]);

  function applyProduct(product: PickerProduct) {
    setProductId(product.id);
    setTitle(product.name);
    setVariant(product.variant ?? "");
    setSize(product.size ?? "");
    setEan(product.ean ?? "");
    if (product.defaultPriceCents != null) {
      setPrice((product.defaultPriceCents / 100).toFixed(2).replace(".", ","));
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>Wareneingang erfassen</Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Wareneingang erfassen</SheetTitle>
          <SheetDescription>
            Netto wird bei Vorsteuerabzug automatisch berechnet. Menge &gt; 1 erzeugt eine Charge mit gemeinsamer Lagernummer.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {products.length > 0 && (
            <>
              <input type="hidden" name="productId" value={productId} />
              <ProductPicker products={products} onSelect={applyProduct} />
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="si-date">Datum *</Label>
              <Input
                id="si-date"
                name="purchaseDate"
                type="date"
                defaultValue={today}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-supplier">Händler</Label>
              <Input
                id="si-supplier"
                name="supplier"
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
                value={size}
                onChange={(e) => setSize(e.target.value)}
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
                defaultValue={zmOptions[0] ?? ""}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {zmOptions.map((zm) => (
                  <option key={zm} value={zm}>
                    {zm}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Konfigurierte schuldrelevante Zahlungsmethoden erzeugen automatisch einen Schulden-Eintrag.
              </p>
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

          <div className="space-y-2">
            <Label htmlFor="si-qty">Menge</Label>
            <Input id="si-qty" name="quantity" type="number" min={1} max={500} defaultValue={1} />
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
                    className="size-4"
                  />
                  {platform.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="si-image-url">Bildadresse</Label>
              <Input id="si-image-url" name="imageUrl" type="url" placeholder="https://…/artikelbild.jpg" />
              <p className="text-xs text-muted-foreground">Bild öffnen → Rechtsklick → „Bildadresse kopieren“. Bitte den direkten öffentlichen Bild-Link einfügen, nicht die Shop-Seite.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-notes">Notizen</Label>
              <Input id="si-notes" name="notes" placeholder="optional" />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert…" : "Artikel eintragen"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
