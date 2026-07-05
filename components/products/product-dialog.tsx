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
  category: string;
  ean: string;
  defaultPriceCents: number | null;
}

/** Anlegen (ohne product-Prop) oder Bearbeiten (mit product-Prop). */
export function ProductDialog({ product }: { product?: EditableProduct }) {
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
      <DialogContent className="sm:max-w-md">
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
              <Label htmlFor="prod-category">Kategorie</Label>
              <Input
                id="prod-category"
                name="category"
                defaultValue={product?.category}
                placeholder="z.B. Elektronik"
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
