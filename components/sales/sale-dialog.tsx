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
  ref: string;
  label: string;
  source: "Eigenbestand" | "Konsignation";
  available: number;
  partner?: string | null;
}

export interface ShippingRateOption {
  id: string;
  carrierName: string;
  name: string;
  countries: string[];
  baseCents: number;
}

export interface EditableSale {
  id: string;
  orderNumber: string;
  soldAt: string;
  itemLabels: string[];
  platformId: string;
  marketplaceAccountId: string;
  saleGross: string;
  buyerCountry: string;
  shippingMethod: string;
  shippingCost: string;
  platformFeeGross: string;
  feeInclVat: boolean;
  platformFeeNet: string;
  payoutRecipient: string;
  status: string;
  invoiceDone: boolean;
  notes: string;
}

interface SelectedSellable {
  item: SellableItem;
  quantity: number;
}

const STATIC_SHIPPING = ["Abholung", "Vinted", "Sonstiges"];

export function SaleDialog({
  sale,
  items,
  platforms,
  marketplaceAccounts,
  payoutOptions,
  shippingRates,
  trigger,
  initialOpen = false,
}: {
  sale?: EditableSale;
  items: SellableItem[];
  platforms: Array<{ id: string; name: string }>;
  marketplaceAccounts: Array<{ id: string; platformId: string; displayName: string; catalogVersion: string | null }>;
  payoutOptions: string[];
  shippingRates: ShippingRateOption[];
  trigger?: React.ReactNode;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [selected, setSelected] = useState<SelectedSellable[]>([]);
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
    const needle = query.trim().toLowerCase();
    const available = items.filter(
      (item) => !selected.some((selection) => selection.item.ref === item.ref)
    );
    if (!needle) return available.slice(0, 10);
    return available
      .filter((item) => item.label.toLowerCase().includes(needle))
      .slice(0, 10);
  }, [items, query, selected]);

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
    if (rate) setShippingCost((rate.baseCents / 100).toFixed(2).replace(".", ","));
    else if (STATIC_SHIPPING.includes(value)) setShippingCost("0,00");
  }

  function updateQuantity(ref: string, quantity: number) {
    setSelected((prev) =>
      prev.map((selection) =>
        selection.item.ref === ref
          ? {
              ...selection,
              quantity: Math.min(
                Math.max(1, Number.isFinite(quantity) ? quantity : 1),
                selection.item.available
              ),
            }
          : selection
      )
    );
  }

  const feeNetPreview = (() => {
    try {
      return formatEuro(
        feeNetCents(feeGross.trim() ? euroToCents(feeGross) : 0, feeInclVat)
      );
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
              ? "Administrative Felder sind änderbar; Positionen und Mengen bleiben fix."
              : "Wähle verfügbare L- oder K-Positionen. Eigenbestand wird bei Bedarf per FIFO über gleiche Produkte allokiert."}
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

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
              <Label htmlFor="sale-item-search">Bestand auswählen *</Label>
              {selected.length > 0 && (
                <div className="space-y-2">
                  {selected.map((selection) => (
                    <div
                      key={selection.item.ref}
                      className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1"
                    >
                      <Badge variant="secondary" className="gap-1">
                        <span className="font-mono text-xs">{selection.item.label}</span>
                        <button
                          type="button"
                          aria-label={`${selection.item.label} entfernen`}
                          onClick={() =>
                            setSelected((prev) =>
                              prev.filter((item) => item.item.ref !== selection.item.ref)
                            )
                          }
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {selection.item.available} verfügbar
                      </span>
                      <input type="hidden" name="itemRefs" value={selection.item.ref} />
                      <Input
                        name="itemQuantities"
                        type="number"
                        min={1}
                        max={selection.item.available}
                        value={selection.quantity}
                        onChange={(event) =>
                          updateQuantity(selection.item.ref, Number(event.target.value))
                        }
                        className="h-7 w-20"
                      />
                    </div>
                  ))}
                </div>
              )}
              <Input
                id="sale-item-search"
                value={query}
                placeholder="Suche nach L-/K-Nummer, Produkt, Variante, Größe, EAN, Partner…"
                autoComplete="off"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                onBlur={() => {
                  blurTimer.current = setTimeout(() => setPickerOpen(false), 150);
                }}
              />
              {pickerOpen && matches.length > 0 && (
                <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                  {matches.map((item) => (
                    <li key={item.ref}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          if (blurTimer.current) clearTimeout(blurTimer.current);
                          setSelected((prev) => [...prev, { item, quantity: 1 }]);
                          setQuery("");
                        }}
                      >
                        <span>
                          <span className="block font-mono text-xs">{item.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.available} verfügbar
                          </span>
                        </span>
                        <Badge variant="outline">
                          {item.source}
                          {item.partner ? ` · ${item.partner}` : ""}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Kein verkaufsfähiger Bestand vorhanden.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="sale-date" name="soldAt" label="Verkaufsdatum" type="date" defaultValue={sale?.soldAt ?? today} />
            <Field id="sale-gross" name="saleGross" label="VK brutto (€) *" required inputMode="decimal" defaultValue={sale?.saleGross} placeholder="z.B. 49,99" />
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
              <Label htmlFor="sale-marketplace-account">Marktplatzkonto</Label>
              <select id="sale-marketplace-account" name="marketplaceAccountId" defaultValue={sale?.marketplaceAccountId ?? ""} className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Kein Konto / manuelle Gebühren</option>
                {marketplaceAccounts.map((account) => <option key={account.id} value={account.id}>{account.displayName}{account.catalogVersion ? ` · Katalog ${account.catalogVersion}` : ""}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-country">Land *</Label>
              <Input
                id="sale-country"
                name="buyerCountry"
                required
                maxLength={2}
                value={country}
                onChange={(event) => setCountry(event.target.value.toUpperCase())}
                list="sale-countries"
                className="uppercase"
              />
              <datalist id="sale-countries">
                {COUNTRIES.map((countryOption) => (
                  <option key={countryOption.code} value={countryOption.code}>
                    {countryOption.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-shipping-method">Versandart</Label>
              <select
                id="sale-shipping-method"
                value={shippingMethod}
                onChange={(event) => applyRate(event.target.value)}
                className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Versandart wählen…</option>
                {countryRates.map((rate) => (
                  <option key={rate.id} value={`${rate.carrierName} ${rate.name}`}>
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
            </div>
            <Field id="sale-shipping-cost" name="shippingCost" label="Versand netto (€)" inputMode="decimal" value={shippingCost} onChange={(event) => setShippingCost(event.target.value)} placeholder="z.B. 5,49" />
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="sale-fee-gross" name="platformFeeGross" label="Plattformgebühren brutto (€)" inputMode="decimal" value={feeGross} onChange={(event) => setFeeGross(event.target.value)} placeholder="z.B. 5,50" />
              <div className="space-y-2">
                <Label>Netto (berechnet)</Label>
                <p className="flex h-9 items-center font-mono text-sm">{feeNetPreview}</p>
              </div>
              <Field id="sale-fee-net" name="platformFeeNetManual" label="Netto manuell (optional)" inputMode="decimal" defaultValue={sale?.platformFeeNet} placeholder="überschreibt Berechnung" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="feeInclVat"
                checked={feeInclVat}
                onChange={(event) => setFeeInclVat(event.target.checked)}
                className="size-4"
              />
              Gebühren inkl. MwSt (Netto = Brutto / 1,19)
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="sale-payout" name="payoutRecipient" label="Auszahlung" list="payout-options" defaultValue={sale?.payoutRecipient} placeholder="wählen oder eintippen" />
            <datalist id="payout-options">
              {payoutOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
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

          <Field id="sale-notes" name="notes" label="Kommentar" defaultValue={sale?.notes} placeholder="optional" />

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

function Field({
  id,
  name,
  label,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  name: string;
  label: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...props} />
    </div>
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
