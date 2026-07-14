"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createProductAction, updateProductAction } from "@/lib/actions/products";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EditableProduct {
  id: string;
  name: string;
  variant: string;
  brand: string;
  category: string;
  ean: string;
  size: string;
  defaultPriceCents: number | null;
  defaultCondition?: string | null;
  defaultShippingCostCents?: number | null;
  defaultPackagingCostCents?: number | null;
  ebayFeeCategoryId?: string | null;
  kauflandFeeCategoryId?: string | null;
}

interface FeeCategoryOption { id: string; label: string; externalId: string; }

/** Anlegen (ohne product-Prop) oder Bearbeiten (mit product-Prop). */
export function ProductDialog({ product, ebayCategories = [], kauflandCategories = [] }: { product?: EditableProduct; ebayCategories?: FeeCategoryOption[]; kauflandCategories?: FeeCategoryOption[] }) {
  const [open, setOpen] = useState(false);
  const action = product
    ? updateProductAction.bind(null, product.id)
    : createProductAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button variant="ghost" size="sm">
            Bearbeiten
          </Button>
        ) : (
          <Button>Produkt anlegen</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {product ? "Produkt bearbeiten" : "Produkt anlegen"}
          </DialogTitle>
          <DialogDescription>
            Katalogprodukte lassen sich beim Wareneingang und Verkauf als
            Vorlage übernehmen.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="prod-name">Name *</Label>
            <Input
              id="prod-name"
              name="name"
              required
              defaultValue={product?.name}
              placeholder="z.B. Amazon Fire TV Stick"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prod-variant">Variante/Version</Label>
              <Input
                id="prod-variant"
                name="variant"
                defaultValue={product?.variant}
                placeholder="z.B. 4K Max, 2. Gen"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-condition">Standardzustand</Label>
              <select id="prod-condition" name="defaultCondition" defaultValue={product?.defaultCondition ?? ""} className="border-input h-9 w-full border bg-background px-3 text-sm">
                <option value="">Kein Standard</option><option value="NEW">Neu</option><option value="OPEN_BOX">Geöffnete Verpackung</option><option value="REFURBISHED">Generalüberholt</option><option value="USED">Gebraucht</option><option value="DEFECTIVE">Defekt</option>
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="prod-shipping">Standardversand (€)</Label><Input id="prod-shipping" name="defaultShippingCost" inputMode="decimal" defaultValue={formatCents(product?.defaultShippingCostCents)} placeholder="0,00" /></div>
            <div className="space-y-2"><Label htmlFor="prod-packaging">Verpackung (€)</Label><Input id="prod-packaging" name="defaultPackagingCost" inputMode="decimal" defaultValue={formatCents(product?.defaultPackagingCostCents)} placeholder="0,00" /></div>
            <div className="space-y-2"><Label htmlFor="prod-ebay-category">eBay-Gebührenkategorie</Label><select id="prod-ebay-category" name="ebayFeeCategoryId" defaultValue={product?.ebayFeeCategoryId ?? ""} className="border-input h-9 w-full border bg-background px-3 text-sm"><option value="">Nicht zugeordnet</option>{ebayCategories.map((item) => <option key={item.id} value={item.id}>{item.label} · #{item.externalId}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="prod-kaufland-category">Kaufland-Gebührenkategorie</Label><select id="prod-kaufland-category" name="kauflandFeeCategoryId" defaultValue={product?.kauflandFeeCategoryId ?? ""} className="border-input h-9 w-full border bg-background px-3 text-sm"><option value="">Nicht zugeordnet</option>{kauflandCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
            <div className="space-y-2">
              <Label htmlFor="prod-category">Kategorie</Label>
              <Input
                id="prod-category"
                name="category"
                defaultValue={product?.category}
                placeholder="z.B. Elektronik"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-brand">Marke</Label>
              <Input
                id="prod-brand"
                name="brand"
                defaultValue={product?.brand}
                placeholder="z.B. Amazon"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-ean">EAN</Label>
              <Input
                id="prod-ean"
                name="ean"
                inputMode="numeric"
                defaultValue={product?.ean}
                placeholder="z.B. 840080588582"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-size">Größe</Label>
              <Input
                id="prod-size"
                name="size"
                defaultValue={product?.size}
                placeholder="z.B. Standard, M, 42"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-price">Standard-EK (€, optional)</Label>
              <Input
                id="prod-price"
                name="defaultPrice"
                inputMode="decimal"
                defaultValue={
                  product?.defaultPriceCents != null
                    ? (product.defaultPriceCents / 100).toFixed(2).replace(".", ",")
                    : ""
                }
                placeholder="z.B. 34,99"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-image">Bild (JPG/PNG/WebP, max. 5 MB)</Label>
            <Input id="prod-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert…" : "Speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatCents(cents: number | null | undefined) {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}
