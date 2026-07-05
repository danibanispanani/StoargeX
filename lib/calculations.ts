// Reine Berechnungsfunktionen für Einkauf, Verkauf und Versand.
// Alle Beträge in Cent (Integer), Rundung kaufmännisch via Math.round.
// Unit-Tests: tests/calculations.test.ts

// ---------------------------------------------------------------------------
// Steuer / Netto
// ---------------------------------------------------------------------------

/** Brutto -> Netto bei gegebenem USt-Satz in Prozent (z.B. 19). */
export function grossToNetCents(grossCents: number, ratePercent: number): number {
  if (ratePercent < 0) throw new Error("Steuersatz darf nicht negativ sein.");
  return Math.round(grossCents / (1 + ratePercent / 100));
}

/**
 * EK netto: nur bei Vorsteuerabzug wird die enthaltene USt herausgerechnet,
 * sonst ist der Bruttopreis zugleich der effektive Nettoeinstand.
 */
export function calcPurchaseNetCents(
  grossCents: number,
  inputTaxDeductible: boolean,
  inputTaxRatePercent: number
): number {
  return inputTaxDeductible
    ? grossToNetCents(grossCents, inputTaxRatePercent)
    : grossCents;
}

// ---------------------------------------------------------------------------
// Verkauf
// ---------------------------------------------------------------------------

/**
 * Plattformgebühren netto: bei "inkl. MwSt" wird die USt (19%) herausgerechnet,
 * sonst entspricht netto dem eingegebenen Betrag.
 */
export function feeNetCents(grossCents: number, inclVat: boolean): number {
  return inclVat ? grossToNetCents(grossCents, 19) : grossCents;
}

export interface SaleCalcInput {
  saleGrossCents: number; // VK brutto
  taxRatePercent: number; // USt-Satz des Käuferlands
  purchaseNetCents: number; // EK netto (siehe calcPurchaseNetCents)
  shippingCostCents: number; // eigene Versandkosten
  platformFeeCents: number;
  paymentFeeCents: number;
}

export interface SaleCalcResult {
  saleNetCents: number; // VK netto
  marginCents: number; // VK netto - EK netto
  profitCents: number; // Marge - Versand - Gebühren
}

export function calcSale(input: SaleCalcInput): SaleCalcResult {
  const saleNetCents = grossToNetCents(input.saleGrossCents, input.taxRatePercent);
  const marginCents = saleNetCents - input.purchaseNetCents;
  const profitCents =
    marginCents -
    input.shippingCostCents -
    input.platformFeeCents -
    input.paymentFeeCents;
  return { saleNetCents, marginCents, profitCents };
}

/**
 * USt-Satz für ein Käuferland aus den TaxRates der Organisation:
 * exakter Länder-Treffer > Default-Satz > 0.
 */
export function resolveTaxRatePercent(
  rates: Array<{ country: string | null; ratePercent: number; isDefault: boolean }>,
  buyerCountry: string
): number {
  const country = buyerCountry.trim().toUpperCase();
  const exact = rates.find((r) => r.country?.toUpperCase() === country);
  if (exact) return exact.ratePercent;
  const fallback = rates.find((r) => r.isDefault);
  return fallback?.ratePercent ?? 0;
}

// ---------------------------------------------------------------------------
// Retouren
// ---------------------------------------------------------------------------

export interface ReturnLossInput {
  refundGrossCents: number; // Erstattung an den Käufer (brutto)
  taxRatePercent: number; // USt-Satz des ursprünglichen Verkaufs
  saleGrossCents: number; // ursprünglicher VK brutto (für den Anteil)
  platformFeeCents: number;
  paymentFeeCents: number;
  shippingCostCents: number; // eigener Versand des Verkaufs
  extraCostCents: number; // Zusatzkosten der Retoure (z.B. Rückversand)
}

/**
 * Tatsächlicher finanzieller Verlust einer Retoure:
 *   Erstattung netto (enthaltene USt kommt vom Finanzamt zurück)
 *   − anteilig zurückerstattete Gebühren/Versand (Anteil = Erstattung/VK,
 *     Plattformen schreiben Gebühren bei Erstattungen anteilig gut)
 *   + Zusatzkosten (z.B. Rückversandlabel)
 * Bei Teilerstattungen wird der Anteil entsprechend kleiner.
 */
export function calcReturnLoss(input: ReturnLossInput): number {
  if (input.refundGrossCents < 0) throw new Error("Erstattung darf nicht negativ sein.");
  const share =
    input.saleGrossCents > 0
      ? Math.min(1, input.refundGrossCents / input.saleGrossCents)
      : 0;
  const refundNet = grossToNetCents(input.refundGrossCents, input.taxRatePercent);
  const recovered = Math.round(
    share *
      (input.platformFeeCents + input.paymentFeeCents + input.shippingCostCents)
  );
  return refundNet - recovered + input.extraCostCents;
}

// ---------------------------------------------------------------------------
// Order-ID
// ---------------------------------------------------------------------------

/**
 * Lesbare Order-ID aus konfigurierbarem Format.
 * Tokens: {JJJJ} Jahr 4-stellig, {JJ} Jahr 2-stellig, {MM} Monat, {TT} Tag,
 * {NR:n} laufende Nummer mit n Stellen (führende Nullen).
 * Beispiel: "SX-{JJJJ}-{NR:4}" + seq 7 -> "SX-2026-0007"
 */
export function formatOrderId(format: string, seq: number, date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return format
    .replaceAll("{JJJJ}", yyyy)
    .replaceAll("{JJ}", yyyy.slice(-2))
    .replaceAll("{MM}", mm)
    .replaceAll("{TT}", dd)
    .replace(/\{NR(?::(\d+))?\}/g, (_, width) =>
      String(seq).padStart(width ? Number(width) : 1, "0")
    );
}

// ---------------------------------------------------------------------------
// Versand
// ---------------------------------------------------------------------------

export interface Surcharge {
  label: string;
  cents: number;
}

export interface ShippingRateLike {
  id?: string;
  carrierName: string;
  name: string;
  zone: string;
  countries: string[]; // ISO-2; leer = gilt für alle Länder
  baseCents: number;
  perKgCents: number;
  maxWeightKg: number | null;
  surcharges: Surcharge[];
  active?: boolean;
}

/** Prüft, ob ein Tarif ein Zielland abdeckt (leere Länderliste = weltweit). */
export function rateCoversCountry(rate: ShippingRateLike, country: string): boolean {
  if (rate.countries.length === 0) return true;
  return rate.countries.map((c) => c.toUpperCase()).includes(country.trim().toUpperCase());
}

/** Grundpreis + Gewicht x Kilopreis (ohne optionale Zuschläge). */
export function calcShippingBaseCents(rate: ShippingRateLike, weightKg: number): number {
  if (weightKg < 0) throw new Error("Gewicht darf nicht negativ sein.");
  return rate.baseCents + Math.round(weightKg * rate.perKgCents);
}

export interface ShippingSuggestion {
  rate: ShippingRateLike;
  costCents: number; // ohne Zuschläge
  surcharges: Surcharge[]; // optional dazu buchbar
}

/**
 * Kalkulator: schlägt für Zielland + Gewicht alle passenden aktiven Tarife
 * vor, günstigster zuerst. Tarife mit überschrittenem Gewichtslimit fliegen raus.
 */
export function suggestShipping(
  rates: ShippingRateLike[],
  country: string,
  weightKg: number
): ShippingSuggestion[] {
  return rates
    .filter((r) => r.active !== false)
    .filter((r) => rateCoversCountry(r, country))
    .filter((r) => r.maxWeightKg === null || weightKg <= r.maxWeightKg)
    .map((rate) => ({
      rate,
      costCents: calcShippingBaseCents(rate, weightKg),
      surcharges: rate.surcharges,
    }))
    .sort((a, b) => a.costCents - b.costCents);
}

/** Zuschläge-JSON aus der DB defensiv in Surcharge[] umwandeln. */
export function parseSurcharges(value: unknown): Surcharge[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is Surcharge =>
      typeof s === "object" &&
      s !== null &&
      typeof (s as Surcharge).label === "string" &&
      typeof (s as Surcharge).cents === "number"
  );
}

// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

export function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

/** "12,50" / "12.50" / "1.299,99" -> Cent. Wirft bei ungültiger Eingabe. */
export function euroToCents(input: string): number {
  const raw = input.trim().replace(/€/g, "").replace(/\s/g, "");
  if (!raw) throw new Error("Betrag fehlt.");
  // deutsches Format: Punkt = Tausender, Komma = Dezimal
  const normalized = /,\d{1,2}$/.test(raw)
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`Ungültiger Betrag: "${input}"`);
  return Math.round(value * 100);
}
