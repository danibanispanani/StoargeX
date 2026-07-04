"use client";

import { useState } from "react";
import {
  formatEuro,
  suggestShipping,
  type ShippingRateLike,
} from "@/lib/calculations";
import { COUNTRIES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Kalkulator: Zielland + Gewicht -> Tarifvorschläge (günstigster zuerst). */
export function ShippingCalculator({ rates }: { rates: ShippingRateLike[] }) {
  const [country, setCountry] = useState("DE");
  const [weight, setWeight] = useState("1");

  const weightKg = Number(weight.replace(",", "."));
  const valid = /^[A-Za-z]{2}$/.test(country) && Number.isFinite(weightKg) && weightKg >= 0;
  const suggestions = valid ? suggestShipping(rates, country, weightKg) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Versandkalkulator</CardTitle>
        <CardDescription>
          Vorschläge aus den unten gepflegten Tarifen – Grundpreis + Gewicht ×
          Kilopreis, Zuschläge separat ausgewiesen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40 space-y-2">
            <Label htmlFor="calc-country">Zielland</Label>
            <Input
              id="calc-country"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              maxLength={2}
              list="calc-countries"
              className="uppercase"
            />
            <datalist id="calc-countries">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </datalist>
          </div>
          <div className="w-40 space-y-2">
            <Label htmlFor="calc-weight">Gewicht (kg)</Label>
            <Input
              id="calc-weight"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              inputMode="decimal"
              placeholder="1,5"
            />
          </div>
        </div>

        {valid && suggestions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Kein Tarif deckt dieses Ziel/Gewicht ab. Tarif unten anlegen oder
            Gewichtslimits prüfen.
          </p>
        )}

        {suggestions.length > 0 && (
          <ul className="space-y-2">
            {suggestions.map((s, index) => (
              <li
                key={s.rate.id ?? `${s.rate.carrierName}-${s.rate.name}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  {index === 0 && <Badge>Günstigster</Badge>}
                  <span className="font-medium">
                    {s.rate.carrierName} {s.rate.name}
                  </span>
                  <span className="text-muted-foreground">({s.rate.zone})</span>
                </div>
                <div className="flex items-center gap-3">
                  {s.surcharges.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Zuschläge:{" "}
                      {s.surcharges
                        .map((z) => `${z.label} +${formatEuro(z.cents)}`)
                        .join(", ")}
                    </span>
                  )}
                  <span className="text-base font-semibold">
                    {formatEuro(s.costCents)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
