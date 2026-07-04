import type {
  ReturnStatus,
  StockItemStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

export const STOCK_STATUS_LABELS: Record<StockItemStatus, string> = {
  IN_STOCK: "Auf Lager",
  LISTED: "Gelistet",
  RESERVED: "Reserviert",
  SOLD: "Verkauft",
  RETURNED: "Retoure",
  CANCELLED: "Storniert",
  IN_TRANSIT: "Unterwegs",
  WRITTEN_OFF: "Abgeschrieben",
};

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
