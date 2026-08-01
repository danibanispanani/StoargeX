"use client";

import { useActionState, useEffect, useState } from "react";
import type { ItemCondition } from "@prisma/client";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import {
  updateInventoryPositionMetadataAction,
  updateLegacyStockItemMetadataAction,
} from "@/lib/actions/stock";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ITEM_CONDITION_OPTIONS } from "@/lib/item-condition-options";

export function StockMetadataDialog({
  source,
  positionId,
  inventoryNumber,
  productName,
  variant,
  size,
  ean,
  itemCondition,
  imageUrls,
  location,
  storageLocations,
  notes,
  onSaved,
}: {
  source: "owned" | "legacy";
  positionId: string;
  inventoryNumber: string;
  productName: string;
  variant: string;
  size: string;
  ean: string;
  itemCondition: ItemCondition | null;
  imageUrls: string[];
  location?: string | null;
  storageLocations: string[];
  notes?: string | null;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const action = source === "owned"
    ? updateInventoryPositionMetadataAction.bind(null, positionId)
    : updateLegacyStockItemMetadataAction.bind(null, positionId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onSaved?.();
      setOpen(false);
    }
  }, [onSaved, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PencilIcon className="size-4" />
          Bearbeiten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{inventoryNumber} bearbeiten</DialogTitle>
          <DialogDescription>
            Produkt- und Lagerdaten bearbeiten. Lagernummer, Zuordnung, Bestandsmengen,
            Einkauf, Kosten und Bewegungen bleiben unveränderbar.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <fieldset className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium">Produktdaten</legend>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${positionId}-product-name`}>Produktname</Label>
              <Input
                id={`${positionId}-product-name`}
                name="productName"
                defaultValue={productName}
                maxLength={300}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${positionId}-variant`}>Variante</Label>
              <Input
                id={`${positionId}-variant`}
                name="variant"
                defaultValue={variant}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${positionId}-size`}>Größe</Label>
              <Input
                id={`${positionId}-size`}
                name="size"
                defaultValue={size}
                maxLength={50}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${positionId}-ean`}>EAN</Label>
              <Input
                id={`${positionId}-ean`}
                name="ean"
                defaultValue={ean}
                maxLength={20}
                inputMode="numeric"
              />
            </div>
            {source === "owned" && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Diese Produktstammdaten werden bei allen Lagerpositionen desselben Produkts aktualisiert.
              </p>
            )}
          </fieldset>
          <fieldset className="space-y-4 rounded-md border p-4">
            <legend className="px-1 text-sm font-medium">Lagerposition</legend>
          <div className="space-y-2">
            <Label htmlFor={`${positionId}-condition`}>Artikelzustand</Label>
            <select
              id={`${positionId}-condition`}
              name="itemCondition"
              defaultValue={itemCondition ?? ""}
              className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Nicht festgelegt</option>
              {ITEM_CONDITION_OPTIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${positionId}-location`}>Lagerplatz</Label>
            <select
              id={`${positionId}-location`}
              name="location"
              defaultValue={location ?? ""}
              className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Nicht festgelegt</option>
              {location && !storageLocations.includes(location) && (
                <option value={location}>{location} (historisch)</option>
              )}
              {storageLocations.map((storageLocation) => (
                <option key={storageLocation} value={storageLocation}>
                  {storageLocation}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Lagerstandorte werden unter Einstellungen → Organisation verwaltet.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${positionId}-images`}>Bildadressen</Label>
            <textarea
              id={`${positionId}-images`}
              name="imageUrls"
              defaultValue={imageUrls.join("\n")}
              rows={3}
              className="border-input w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Eine öffentliche HTTP-/HTTPS-Adresse je Zeile"
            />
            <p className="text-xs text-muted-foreground">
              Bild öffnen, Rechtsklick auf das Bild und „Bildadresse kopieren“. Die Bilder werden nur verlinkt, nicht hochgeladen.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${positionId}-notes`}>Notiz</Label>
            <textarea
              id={`${positionId}-notes`}
              name="notes"
              defaultValue={notes ?? ""}
              rows={3}
              maxLength={2000}
              className="border-input w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          </fieldset>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert…" : "Änderungen speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
