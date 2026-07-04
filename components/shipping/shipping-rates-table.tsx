"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  deleteShippingRateAction,
  toggleShippingRateAction,
} from "@/lib/actions/shipping";
import { formatEuro, type ShippingRateLike } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Rate = ShippingRateLike & { id: string; active: boolean };

export function ShippingRatesTable({ rates }: { rates: Rate[] }) {
  const [pending, startTransition] = useTransition();

  function toggle(rate: Rate) {
    startTransition(async () => {
      const result = await toggleShippingRateAction(rate.id, !rate.active);
      if (result?.error) toast.error(result.error);
    });
  }

  function remove(rate: Rate) {
    if (!confirm(`Tarif "${rate.carrierName} ${rate.name}" wirklich löschen?`)) return;
    startTransition(async () => {
      const result = await deleteShippingRateAction(rate.id);
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarife ({rates.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dienstleister</TableHead>
              <TableHead>Tarif</TableHead>
              <TableHead>Zone / Länder</TableHead>
              <TableHead className="text-right">Grundpreis</TableHead>
              <TableHead className="text-right">Kilopreis</TableHead>
              <TableHead className="text-right">max. kg</TableHead>
              <TableHead>Zuschläge</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Noch keine Tarife angelegt.
                </TableCell>
              </TableRow>
            )}
            {rates.map((rate) => (
              <TableRow key={rate.id} className={rate.active ? "" : "opacity-50"}>
                <TableCell className="font-medium">{rate.carrierName}</TableCell>
                <TableCell>{rate.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{rate.zone}</Badge>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {rate.countries.length ? rate.countries.join(", ") : "alle Länder"}
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatEuro(rate.baseCents)}</TableCell>
                <TableCell className="text-right">
                  {rate.perKgCents ? `${formatEuro(rate.perKgCents)}/kg` : "–"}
                </TableCell>
                <TableCell className="text-right">
                  {rate.maxWeightKg ?? "–"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {rate.surcharges.length
                    ? rate.surcharges
                        .map((s) => `${s.label} +${formatEuro(s.cents)}`)
                        .join(", ")
                    : "–"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => toggle(rate)}
                    >
                      {rate.active ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={pending}
                      onClick={() => remove(rate)}
                    >
                      Löschen
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
