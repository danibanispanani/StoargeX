import type {
  DebtEntry,
  DebtKind,
  DebtStatus,
  EntryStatus,
  ReturnStatus,
  SaleStatus,
  StockItemStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Lager-Status (wie Excel-Original, mit Farbcodierung)
// ---------------------------------------------------------------------------

export interface StatusStyle {
  label: string;
  className: string; // Badge-/Select-Färbung
}

// Zentrale Farbtöne (Markenpalette, hell + dunkel) – überall konsistent:
//  positive → transit-teal · warn → cargo-amber · negative → customs-red
//  neutral → slate · info → gedämpftes Blau
export const TONE = {
  positive: "bg-transit-teal/15 text-teal-700 dark:text-teal-300",
  warn: "bg-cargo-amber/15 text-amber-700 dark:text-amber-300",
  negative: "bg-customs-red/15 text-red-700 dark:text-red-300",
  neutral: "bg-slate/15 text-slate-600 dark:text-slate-300",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
} as const;

export const STOCK_STATUS: Record<StockItemStatus, StatusStyle> = {
  SOLD: { label: "Verkauft", className: TONE.positive },
  STORED_R: { label: "gelagert - R", className: TONE.info },
  STORED_D: { label: "gelagert - D", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  IN_STOCK: { label: "gelagert", className: TONE.info },
  RETURNED: { label: "Retoure", className: TONE.negative },
  CANCELLED: { label: "Storniert", className: TONE.neutral },
  IN_TRANSIT: { label: "Unterwegs", className: TONE.warn },
  OTHER: { label: "Sonstiges", className: TONE.neutral },
  // Altwerte – werden in Dropdowns nicht mehr angeboten
  LISTED: { label: "gelagert", className: TONE.info },
  RESERVED: { label: "gelagert", className: TONE.info },
  WRITTEN_OFF: { label: "Sonstiges", className: TONE.neutral },
};

/** Status-Werte, die in Dropdowns angeboten werden (Reihenfolge = Anzeige). */
export const STOCK_STATUS_OPTIONS: StockItemStatus[] = [
  "SOLD",
  "STORED_R",
  "STORED_D",
  "IN_STOCK",
  "RETURNED",
  "CANCELLED",
  "IN_TRANSIT",
  "OTHER",
];

/** Kompatibilität für ältere Module (Retouren-Seite etc.). */
export const STOCK_STATUS_LABELS: Record<StockItemStatus, string> =
  Object.fromEntries(
    Object.entries(STOCK_STATUS).map(([key, value]) => [key, value.label])
  ) as Record<StockItemStatus, string>;

// ---------------------------------------------------------------------------
// Kauf-/Retoure-Buchungsstatus (E/O/NN/S) mit Farbcodierung
// ---------------------------------------------------------------------------

export const ENTRY_STATUS: Record<EntryStatus, StatusStyle> = {
  E: { label: "E", className: TONE.positive },
  O: { label: "O", className: TONE.warn },
  NN: { label: "NN", className: TONE.neutral },
  S: { label: "S", className: TONE.info },
};

export const ENTRY_STATUS_TITLES: Record<EntryStatus, string> = {
  E: "Eingetragen",
  O: "Offen / ausstehend",
  NN: "Nicht nötig",
  S: "Sonstiges",
};

/** Kauf kennt kein "S". */
export const KAUF_STATUS_OPTIONS: EntryStatus[] = ["E", "O", "NN"];
export const RETOURE_STATUS_OPTIONS: EntryStatus[] = ["E", "O", "NN", "S"];

// ---------------------------------------------------------------------------
// Verkauf: Gesamtstatus & Rechnung
// ---------------------------------------------------------------------------

/** Gesamtstatus im Verkauf: nur diese zwei Werte werden angeboten. */
export const SALE_STATUS: Partial<Record<SaleStatus, StatusStyle>> = {
  PENDING: { label: "in Bearbeitung", className: TONE.warn },
  COMPLETED: { label: "Abgeschlossen", className: TONE.positive },
  // Altwerte lesbar halten
  PAID: { label: "in Bearbeitung", className: TONE.warn },
  SHIPPED: { label: "in Bearbeitung", className: TONE.warn },
  CANCELLED: { label: "Storniert", className: TONE.neutral },
  REFUNDED: { label: "Erstattet", className: TONE.negative },
};

export const INVOICE_STATUS: Record<"done" | "open", StatusStyle> = {
  done: { label: "Erledigt", className: TONE.positive },
  open: { label: "Offen", className: TONE.warn },
};

// ---------------------------------------------------------------------------
// Standard-Seeds für konfigurierbare Auswahllisten
// ---------------------------------------------------------------------------

export const DEFAULT_PAYMENT_METHODS = ["Firma", "Firma D", "Firma R", "Richard", "Daniel"];
export const DEFAULT_PAYOUT_RECIPIENTS = ["Firma", "Richard", "Daniel", "PayPal R", "Bar D", "Bar R"];
export const DEFAULT_PLATFORMS = ["eBay R", "eBay D", "Vinted", "KA", "StockX", "Discord", "Sonstiges"];

/** ZM-Werte, die KEINEN automatischen Schulden-Eintrag auslösen. */
export function paymentMethodCreatesDebt(zm: string): boolean {
  return !zm.toLowerCase().startsWith("firma");
}

// ---------------------------------------------------------------------------
// Retouren-Modul & Aufgaben (unverändert)
// ---------------------------------------------------------------------------

export const RETURN_STATUS: Record<ReturnStatus, StatusStyle> = {
  REQUESTED: { label: "Angekündigt", className: TONE.warn },
  REJECTED: { label: "Storniert", className: TONE.neutral },
  RESTOCKED: { label: "Gelagert", className: TONE.info },
  REFUNDED: { label: "Erstattet", className: TONE.positive },
  CONFLICT: { label: "Konflikt", className: TONE.negative },
  RECEIVED: { label: "Angekündigt", className: TONE.warn },
};

export const RETURN_STATUS_OPTIONS: ReturnStatus[] = [
  "REQUESTED",
  "REJECTED",
  "RESTOCKED",
  "REFUNDED",
  "CONFLICT",
];

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> =
  Object.fromEntries(
    Object.entries(RETURN_STATUS).map(([key, value]) => [key, value.label])
  ) as Record<ReturnStatus, string>;

// ---------------------------------------------------------------------------
// Schulden
// ---------------------------------------------------------------------------

export const DEBT_KIND_LABELS: Record<DebtKind, string> = {
  KAUF: "Kauf",
  VERKAUF: "Verkauf",
  SONSTIGES: "Sonstiges",
};

export const DEBT_STATUS: Record<DebtStatus, StatusStyle> = {
  OPEN: { label: "Offen", className: TONE.warn },
  SETTLED: { label: "Beglichen", className: TONE.positive },
  OTHER: { label: "Sonstiges", className: TONE.neutral },
  PARTIALLY_PAID: { label: "Offen", className: TONE.warn },
};

export const DEBT_STATUS_OPTIONS: DebtStatus[] = ["OPEN", "SETTLED", "OTHER"];

export const DEBT_ENTRY: Record<DebtEntry, StatusStyle> = {
  IO: { label: "I.O", className: TONE.positive },
  FEHLT: { label: "Fehlt", className: TONE.negative },
};

/** Standard-Bereiche für Aufgaben (in Einstellungen erweiterbar). */
export const DEFAULT_TASK_AREAS = [
  "Listing",
  "Buchhaltung",
  "GbR Intern",
  "Bilder",
  "Rechtsstreit",
  "Versand",
  "Steuerrecht",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Arbeit",
  DONE: "Erledigt",
  CANCELLED: "Abgebrochen",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Hoch", // Altwert, wird wie Hoch behandelt
};

/** Angebotene Prioritäten: Hoch (rot), Mittel (amber), Niedrig (grün). */
export const TASK_PRIORITY_OPTIONS: TaskPriority[] = ["HIGH", "MEDIUM", "LOW"];

export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  HIGH: TONE.negative,
  URGENT: TONE.negative,
  MEDIUM: TONE.warn,
  LOW: TONE.positive,
};

/** Häufige Käufer-/Zielländer (ISO-2) für Selects und Datalists. */
export const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" },
  { code: "CH", name: "Schweiz" },
  { code: "FR", name: "Frankreich" },
  { code: "NL", name: "Niederlande" },
  { code: "BE", name: "Belgien" },
  { code: "IT", name: "Italien" },
  { code: "ES", name: "Spanien" },
  { code: "PL", name: "Polen" },
  { code: "CZ", name: "Tschechien" },
  { code: "DK", name: "Dänemark" },
  { code: "SE", name: "Schweden" },
  { code: "GB", name: "Großbritannien" },
  { code: "US", name: "USA" },
];
