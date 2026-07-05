import type {
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

export const STOCK_STATUS: Record<StockItemStatus, StatusStyle> = {
  SOLD: { label: "Verkauft", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  STORED_R: { label: "gelagert - R", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  STORED_D: { label: "gelagert - D", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  IN_STOCK: { label: "gelagert", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  RETURNED: { label: "Retoure", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  CANCELLED: { label: "Storniert", className: "bg-muted text-muted-foreground" },
  IN_TRANSIT: { label: "Unterwegs", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  OTHER: { label: "Sonstiges", className: "bg-muted text-muted-foreground" },
  // Altwerte – werden in Dropdowns nicht mehr angeboten
  LISTED: { label: "gelagert", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  RESERVED: { label: "gelagert", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  WRITTEN_OFF: { label: "Sonstiges", className: "bg-muted text-muted-foreground" },
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
  E: { label: "E", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  O: { label: "O", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  NN: { label: "NN", className: "bg-muted text-muted-foreground" },
  S: { label: "S", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
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
  PENDING: { label: "in Bearbeitung", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  COMPLETED: { label: "Abgeschlossen", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  // Altwerte lesbar halten
  PAID: { label: "in Bearbeitung", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  SHIPPED: { label: "in Bearbeitung", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  CANCELLED: { label: "Storniert", className: "bg-muted text-muted-foreground" },
  REFUNDED: { label: "Erstattet", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

export const INVOICE_STATUS: Record<"done" | "open", StatusStyle> = {
  done: { label: "Erledigt", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  open: { label: "Offen", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
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

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Angemeldet",
  RECEIVED: "Erhalten",
  REFUNDED: "Erstattet",
  RESTOCKED: "Wieder eingelagert",
  REJECTED: "Abgelehnt",
};

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
  URGENT: "Dringend",
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
