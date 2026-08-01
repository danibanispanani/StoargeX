import type { PurchaseShippingStatus, PurchaseStatus } from "@prisma/client";

export const DEFAULT_PURCHASE_STATUS = "CONFIRMED" as const satisfies PurchaseStatus;

export const PURCHASE_STATUS_VALUES = [
  "CONFIRMED",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
] as const satisfies ReadonlyArray<PurchaseStatus>;

export const PURCHASE_SHIPPING_STATUS_VALUES = [
  "NOT_SHIPPED",
  "SHIPPED",
  "PARTIALLY_RECEIVED",
  "DELIVERED",
  "UNKNOWN",
] as const satisfies ReadonlyArray<PurchaseShippingStatus>;

export const RETURN_WINDOW_DAYS = [14, 30] as const;

export const PURCHASE_STATUS_LABELS: Record<(typeof PURCHASE_STATUS_VALUES)[number], string> = {
  CONFIRMED: "Bestätigt",
  ORDERED: "Bestellt",
  PARTIALLY_RECEIVED: "Teilweise eingegangen",
  RECEIVED: "Vollständig eingegangen",
};

export const PURCHASE_SHIPPING_STATUS_LABELS: Record<(typeof PURCHASE_SHIPPING_STATUS_VALUES)[number], string> = {
  NOT_SHIPPED: "Noch nicht versendet",
  SHIPPED: "Versendet",
  PARTIALLY_RECEIVED: "Teilweise eingegangen",
  DELIVERED: "Zugestellt",
  UNKNOWN: "Unbekannt",
};
