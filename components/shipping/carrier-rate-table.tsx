"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  deleteShippingRateAction,
  toggleShippingRateAction,
} from "@/lib/actions/shipping";
import { formatEuro } from "@/lib/calculations";
import {
  ShippingRateDialog,
  type EditableRate,
} from "@/components/shipping/shipping-rate-dialog";
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

export interface CarrierRate {
  id: string;
  carrierName: string;
  name: string;
  zone: string;
  countries: string[];
  baseCents: number;
  perKgCents: number;
  maxWeightKg: number | null;
  surcharges: Array<{ label: string; cents: number }>;
  active: boolean;
}

/** Eine Tariftabelle je Versanddienstleister (wie das Excel-Sheet "DHL"). */
export function CarrierRateTable({
  carrier,
  rates,
}: {
  carrier: string;
  rates: CarrierRate[];
}) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; success?: string } | null>) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display">{carrier}</CardTitle>
        <ShippingRateDialog
          defaultCarrier={carrier}
          trigger={
            <Button variant="outline" size="sm">
              Tarif hinzufügen
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarif</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Länder</TableHead>
              <TableHead className="text-right">Gewichtsklasse</TableHead>
              <TableHead className="text-right">Grundpreis</TableHead>
              <TableHead className="text-right">Kilopreis</TableHead>
              <TableHead>Zuschläge</TableHead>
              <TableHead className="w-48" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((rate) => (
              <TableRow key={rate.id} className={rate.active ? "" : "opacity-50"}>
                <TableCell className="font-medium">{rate.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{rate.zone}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {rate.countries.length ? rate.countries.join(", ") : "alle"}
                </TableCell>
                <TableCell className="text-right">
                  {rate.maxWeightKg !== null ? `bis ${rate.maxWeightKg} kg` : "–"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatEuro(rate.baseCents)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {rate.perKgCents ? `${formatEuro(rate.perKgCents)}/kg` : "–"}
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
                    <ShippingRateDialog
                      rate={toEditable(rate)}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Bearbeiten
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => toggleShippingRateAction(rate.id, !rate.active))
                      }
                    >
                      {rate.active ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Tarif "${rate.name}" wirklich löschen?`)) return;
                        run(() => deleteShippingRateAction(rate.id));
                      }}
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

function toEditable(rate: CarrierRate): EditableRate {
  return {
    id: rate.id,
    carrierName: rate.carrierName,
    name: rate.name,
    zone: rate.zone,
    countries: rate.countries.join(", "),
    basePrice: (rate.baseCents / 100).toFixed(2).replace(".", ","),
    perKgPrice: rate.perKgCents ? (rate.perKgCents / 100).toFixed(2).replace(".", ",") : "",
    maxWeightKg: rate.maxWeightKg !== null ? String(rate.maxWeightKg) : "",
    surchargesJson: rate.surcharges.length ? JSON.stringify(rate.surcharges) : "",
  };
}
