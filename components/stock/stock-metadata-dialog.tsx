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
  itemCondition,
  imageUrls,
  location,
  notes,
  onSaved,
}: {
  source: "owned" | "legacy";
  positionId: string;
  inventoryNumber: string;
  itemCondition: ItemCondition | null;
  imageUrls: string[];
  location?: string | null;
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
          Metadaten bearbeiten
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{inventoryNumber} bearbeiten</DialogTitle>
          <DialogDescription>
            Bestandsmengen, Einkauf, Kosten und Bewegungen bleiben unveränderbar.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
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
          {source === "legacy" && (
            <div className="space-y-2">
              <Label htmlFor={`${positionId}-location`}>Lagerplatz</Label>
              <Input
                id={`${positionId}-location`}
                name="location"
                defaultValue={location ?? ""}
                maxLength={200}
              />
            </div>
          )}
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
          {source === "legacy" && (
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
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichert…" : "Änderungen speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
