"use client";

import { useTransition } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
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
import { ActionIconButton } from "@/components/ui/action-icon-button";
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
    <Card className="rounded-none border-x-0 border-t-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between py-3">
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
        <Table className="sx-datatable">
          <TableHeader>
            <TableRow>
              <TableHead data-column data-column-key="carrier" data-view-standard data-view-active data-view-inactive data-view-all>Dienstleister</TableHead>
              <TableHead data-column data-column-key="rate" data-view-standard data-view-active data-view-inactive data-view-all>Tarif</TableHead>
              <TableHead data-column data-column-key="zone" data-view-standard data-view-active data-view-inactive data-view-all>Zone</TableHead>
              <TableHead data-column data-column-key="countries" data-view-standard data-view-active data-view-inactive data-view-all>Länder</TableHead>
              <TableHead data-column data-column-key="weight" data-view-standard data-view-active data-view-inactive data-view-all className="text-right">Gewichtsklasse</TableHead>
              <TableHead data-column data-column-key="base" data-view-standard data-view-active data-view-inactive data-view-all className="text-right">Grundpreis</TableHead>
              <TableHead data-column data-column-key="perKg" data-view-all className="text-right">Kilopreis</TableHead>
              <TableHead data-column data-column-key="surcharges" data-view-all>Zuschläge</TableHead>
              <TableHead data-column data-column-key="status" data-view-standard data-view-active data-view-inactive data-view-all>Status</TableHead>
              <TableHead data-column data-column-key="actions" data-view-standard data-view-active data-view-inactive data-view-all className="w-48">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((rate) => (
              <TableRow
                key={rate.id}
                className={rate.active ? "" : "opacity-60"}
                data-table-view-row
                data-row-view-standard
                data-row-view-active={rate.active || undefined}
                data-row-view-inactive={!rate.active || undefined}
                data-row-view-all
              >
                <TableCell data-column data-column-key="carrier" data-view-standard data-view-active data-view-inactive data-view-all className="font-medium">{carrier}</TableCell>
                <TableCell data-column data-column-key="rate" data-view-standard data-view-active data-view-inactive data-view-all className="font-medium">{rate.name}</TableCell>
                <TableCell data-column data-column-key="zone" data-view-standard data-view-active data-view-inactive data-view-all>
                  <Badge variant="outline">{rate.zone}</Badge>
                </TableCell>
                <TableCell data-column data-column-key="countries" data-view-standard data-view-active data-view-inactive data-view-all className="text-xs text-muted-foreground">
                  {rate.countries.length ? rate.countries.join(", ") : "alle"}
                </TableCell>
                <TableCell data-column data-column-key="weight" data-view-standard data-view-active data-view-inactive data-view-all className="text-right">
                  {rate.maxWeightKg !== null ? `bis ${rate.maxWeightKg} kg` : "–"}
                </TableCell>
                <TableCell data-column data-column-key="base" data-view-standard data-view-active data-view-inactive data-view-all className="text-right font-mono">
                  {formatEuro(rate.baseCents)}
                </TableCell>
                <TableCell data-column data-column-key="perKg" data-view-all className="text-right font-mono">
                  {rate.perKgCents ? `${formatEuro(rate.perKgCents)}/kg` : "–"}
                </TableCell>
                <TableCell data-column data-column-key="surcharges" data-view-all className="text-xs text-muted-foreground">
                  {rate.surcharges.length
                    ? rate.surcharges
                        .map((s) => `${s.label} +${formatEuro(s.cents)}`)
                        .join(", ")
                    : "–"}
                </TableCell>
                <TableCell data-column data-column-key="status" data-view-standard data-view-active data-view-inactive data-view-all>
                  <Badge variant={rate.active ? "secondary" : "outline"}>
                    {rate.active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </TableCell>
                <TableCell data-column data-column-key="actions" data-view-standard data-view-active data-view-inactive data-view-all>
                  <div className="flex gap-1">
                    <ShippingRateDialog
                      rate={toEditable(rate)}
                      trigger={
                        <ActionIconButton label="Versandtarif bearbeiten" icon={PencilIcon} />
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
                    <ActionIconButton
                      label="Versandtarif löschen"
                      icon={Trash2Icon}
                      className="text-destructive"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Tarif "${rate.name}" wirklich löschen?`)) return;
                        run(() => deleteShippingRateAction(rate.id));
                      }}
                    />
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
