"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createSaleAction, updateSaleAction } from "@/lib/actions/sales";
import type { ActionState } from "@/lib/actions/team";
import { COUNTRIES } from "@/lib/constants";
import { euroToCents, feeNetCents, formatEuro } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
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

export interface SellableItem {
  ref: string; // "stock:<id>" | "consignment:<id>"
  label: string; // "L-26-001 · Fire TV Stick (4K) · XL"
  source: "Lager" | "Konsignation";
}

export interface ShippingRateOption {
  id: string;
  carrierName: string;
  name: string;
  countries: string[]; // leer = alle Länder
  baseCents: number;
}

export interface EditableSale {
  id: string;
  orderNumber: string;
  soldAt: string; // yyyy-mm-dd
  itemLabels: string[];
  platformId: string;
  saleGross: string;
  buyerCountry: string;
  shippingMethod: string;
  shippingCost: string;
  platformFeeGross: string;
  feeInclVat: boolean;
  platformFeeNet: string;
  payoutRecipient: string;
  status: string; // PENDING | COMPLETED
  invoiceDone: boolean;
  notes: string;
}

const STATIC_SHIPPING = ["Abholung", "Vinted", "Sonstiges"];

export function SaleDialog({
  sale,
  items,
  platforms,
  payoutOptions,
  shippingRates,
  trigger,
}: {
  sale?: EditableSale;
  items: SellableItem[];
  platforms: Array<{ id: string; name: string }>;
  payoutOptions: string[];
  shippingRates: ShippingRateOption[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SellableItem[]>([]);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [country, setCountry] = useState(sale?.buyerCountry ?? "DE");
  const [shippingMethod, setShippingMethod] = useState(sale?.shippingMethod ?? "");
  const [shippingCost, setShippingCost] = useState(sale?.shippingCost ?? "");
  const [feeGross, setFeeGross] = useState(sale?.platformFeeGross ?? "");
  const [feeInclVat, setFeeInclVat] = useState(sale?.feeInclVat ?? true);

  const action = sale ? updateSaleAction.bind(null, sale.id) : createSaleAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      if (!sale) {
        setSelected([]);
        setQuery("");
        setShippingMethod("");
        setShippingCost("");
        setFeeGross("");
      }
    }
  }, [state, sale]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = items.filter(
      (item) => !selected.some((s) => s.ref === item.ref)
    );
    if (!q) return available.slice(0, 8);
    return available
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, query, selected]);

  // Versandarten: Tarife des gewählten Landes + statische Optionen
  const countryRates = useMemo(
    () =>
      shippingRates.filter(
        (rate) =>
          rate.countries.length === 0 ||
          rate.countries.includes(country.trim().toUpperCase())
      ),
    [shippingRates, country]
  );

  function applyRate(value: string) {
    setShippingMethod(value);
    const rate = countryRates.find((r) => `${r.carrierName} ${r.name}` === value);
    if (rate) {
      setShippingCost((rate.baseCents / 100).toFixed(2).replace(".", ","));
    } else if (STATIC_SHIPPING.includes(value)) {
      setShippingCost("0,00");
    }
  }

  const feeNetPreview = (() => {
    try {
      return formatEuro(feeNetCents(feeGross.trim() ? euroToCents(feeGross) : 0, feeInclVat));
    } catch {
      return "–";
    }
  })();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? <Button>Verkauf erfassen</Button>}
      </SheetTrigger>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {sale ? `Verkauf ${sale.orderNumber} bearbeiten` : "Verkauf erfassen"}
          </SheetTitle>
          <SheetDescription>
            {sale
              ? "Beträge, Status und Details sind änderbar; die Positionen bleiben fix."
              : "Ein Verkauf kann mehrere Artikel aus Lager und Konsignation enthalten. Steuern, Netto und Gewinn werden automatisch berechnet."}
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Artikel-Auswahl */}
          {sale ? (
            <div className="space-y-1">
              <Label>Positionen</Label>
              <div className="flex flex-wrap gap-1.5">
                {sale.itemLabels.map((label) => (
                  <Badge key={label} variant="outline" className="font-mono text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative space-y-2">
              <Label htmlFor="sale-item-search">Artikel (Lager & Konsignation) *</Label>
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((item) => (
                    <Badge key={item.ref} variant="secondary" className="gap-1">
                      <span className="font-mono text-xs">{item.label}</span>
                      <button
                        type="button"
                        aria-label={`${item.label} entfernen`}
                        onClick={() =>
                          setSelected((prev) => prev.filter((s) => s.ref !== item.ref))
                        }
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                      <input type="hidden" name="itemRefs" value={item.ref} />
                    </Badge>
                  ))}
                </div>
              )}
              <Input
                id="sale-item-search"
                value={query}
                placeholder="Suche nach LagerID, Model, Größe…"
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                onBlur={() => {
                  blurTimer.current = setTimeout(() => setPickerOpen(false), 150);
                }}
              />
              {pickerOpen && matches.length > 0 && (
                <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                  {matches.map((item) => (
                    <li key={item.ref}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (blurTimer.current) clearTimeout(blurTimer.current);
                          setSelected((prev) => [...prev, item]);
                          setQuery("");
                        }}
                      >
                        <span className="font-mono text-xs">{item.label}</span>
                        <Badge variant="outline">{item.source}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Kein verkaufsfähiger Bestand – erst im Lager oder in der
                  Konsignation Artikel eintragen.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sale-date">Verkaufsdatum</Label>
              <Input
                id="sale-date"
                name="soldAt"
                type="date"
                defaultValue={sale?.soldAt ?? today}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-gross">VK brutto (€) *</Label>
              <Input
                id="sale-gross"
                name="saleGross"
                required
                inputMode="decimal"
                defaultValue={sale?.saleGross}
                placeholder="z.B. 49,99"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-platform">Plattform *</Label>
              <SearchablePlatformSelect
                id="sale-platform"
                name="platformId"
                platforms={platforms}
                defaultValue={sale?.platformId ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-country">Land *</Label>
              <Input
                id="sale-country"
                name="buyerCountry"
                required
                maxLength={2}
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                list="sale-countries"
                className="uppercase"
              />
              <datalist id="sale-countries">
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-shipping-method">Versandart</Label>
              <select
                id="sale-shipping-method"
                value={shippingMethod}
                onChange={(e) => applyRate(e.target.value)}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Versandart wählen…</option>
                {countryRates.map((rate) => (
                  <option
                    key={rate.id}
                    value={`${rate.carrierName} ${rate.name}`}
                  >
                    {rate.carrierName} {rate.name} ({formatEuro(rate.baseCents)})
                  </option>
                ))}
                {STATIC_SHIPPING.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <input type="hidden" name="shippingMethod" value={shippingMethod} />
              <p className="text-xs text-muted-foreground">
                Tarife gefiltert nach Land „{country || "–"}&ldquo; · Preis
                überschreibbar
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-shipping-cost">Versand netto (€)</Label>
              <Input
                id="sale-shipping-cost"
                name="shippingCost"
                inputMode="decimal"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                placeholder="z.B. 5,49"
              />
            </div>
          </div>

          {/* Plattformgebühren */}
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sale-fee-gross">Plattformgebühren brutto (€)</Label>
                <Input
                  id="sale-fee-gross"
                  name="platformFeeGross"
                  inputMode="decimal"
                  value={feeGross}
                  onChange={(e) => setFeeGross(e.target.value)}
                  placeholder="z.B. 5,50"
                />
              </div>
              <div className="space-y-2">
                <Label>Netto (berechnet)</Label>
                <p className="flex h-9 items-center font-mono text-sm">{feeNetPreview}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-fee-net">Netto manuell (optional)</Label>
                <Input
                  id="sale-fee-net"
                  name="platformFeeNetManual"
                  inputMode="decimal"
                  defaultValue={sale?.platformFeeNet}
                  placeholder="überschreibt Berechnung"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="feeInclVat"
                checked={feeInclVat}
                onChange={(e) => setFeeInclVat(e.target.checked)}
                className="size-4"
              />
              Gebühren inkl. MwSt (Netto = Brutto / 1,19)
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sale-payout">Auszahlung</Label>
              <Input
                id="sale-payout"
                name="payoutRecipient"
                list="payout-options"
                defaultValue={sale?.payoutRecipient}
                placeholder="wählen oder eintippen"
              />
              <datalist id="payout-options">
                {payoutOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-status">Gesamtstatus</Label>
              <select
                id="sale-status"
                name="status"
                defaultValue={sale?.status ?? "PENDING"}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="PENDING">in Bearbeitung</option>
                <option value="COMPLETED">Abgeschlossen</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-invoice">Rechnung</Label>
              <select
                id="sale-invoice"
                name="invoiceDone"
                defaultValue={sale?.invoiceDone ? "on" : ""}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Offen</option>
                <option value="on">Erledigt</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale-notes">Kommentar</Label>
            <Input id="sale-notes" name="notes" defaultValue={sale?.notes} placeholder="optional" />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={pending || (!sale && selected.length === 0)}
          >
            {pending ? "Speichert…" : sale ? "Änderungen speichern" : "Verkauf speichern"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SearchablePlatformSelect({
  id,
  name,
  platforms,
  defaultValue,
}: {
  id: string;
  name: string;
  platforms: Array<{ id: string; name: string }>;
  defaultValue: string;
}) {
  const initial = platforms.find((platform) => platform.id === defaultValue);
  const [selectedId, setSelectedId] = useState(defaultValue);
  const [query, setQuery] = useState(initial?.name ?? "");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return platforms.slice(0, 8);
    return platforms
      .filter((platform) => platform.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [platforms, query]);

  return (
    <div className="relative">
      <Input
        id={id}
        value={query}
        placeholder="Plattform suchen..."
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      <input type="hidden" name={name} value={selectedId} />
      {open && matches.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {matches.map((platform) => (
            <li key={platform.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  setSelectedId(platform.id);
                  setQuery(platform.name);
                  setOpen(false);
                }}
              >
                {platform.name}
                {selectedId === platform.id && (
                  <span className="text-xs text-muted-foreground">ausgewählt</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
