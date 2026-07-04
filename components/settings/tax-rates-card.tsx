"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { deleteTaxRateAction, upsertTaxRateAction } from "@/lib/actions/tax-rates";
import type { ActionState } from "@/lib/actions/team";
import { COUNTRIES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface TaxRateRow {
  id: string;
  name: string;
  ratePercent: number;
  country: string | null;
  isDefault: boolean;
}

/** USt-Sätze je Käuferland – Grundlage der VK-netto-Berechnung im Verkauf. */
export function TaxRatesCard({
  rates,
  readOnly,
}: {
  rates: TaxRateRow[];
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    upsertTaxRateAction,
    null
  );
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    if (state?.success) toast.success(state.success);
  }, [state]);

  function remove(rate: TaxRateRow) {
    if (!confirm(`Steuersatz "${rate.name}" wirklich löschen?`)) return;
    startDelete(async () => {
      const result = await deleteTaxRateAction(rate.id);
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Land</TableHead>
            <TableHead className="text-right">Satz</TableHead>
            <TableHead>Default</TableHead>
            {!readOnly && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rates.map((rate) => (
            <TableRow key={rate.id}>
              <TableCell>{rate.name}</TableCell>
              <TableCell>{rate.country ?? "–"}</TableCell>
              <TableCell className="text-right">{rate.ratePercent} %</TableCell>
              <TableCell>
                {rate.isDefault && <Badge variant="secondary">Default</Badge>}
              </TableCell>
              {!readOnly && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={deleting}
                    onClick={() => remove(rate)}
                  >
                    Löschen
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!readOnly && (
        <form action={formAction} className="space-y-3 rounded-md border p-3">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="tr-name">Name</Label>
              <Input id="tr-name" name="name" required placeholder="Österreich 20%" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tr-country">Land (leer = alle)</Label>
              <Input
                id="tr-country"
                name="country"
                maxLength={2}
                list="tr-countries"
                placeholder="AT"
                className="uppercase"
              />
              <datalist id="tr-countries">
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tr-rate">Satz (%)</Label>
              <Input
                id="tr-rate"
                name="ratePercent"
                required
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="20"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isDefault" className="size-4" />
              Als Default-Satz verwenden (Fallback für Länder ohne eigenen Satz)
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Speichert…" : "Steuersatz hinzufügen"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
