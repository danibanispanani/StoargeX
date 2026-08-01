import type {
  InventoryBucket,
  InventoryMovementType,
} from "@prisma/client";

const INVENTORY_BUCKET_LABELS: Record<InventoryBucket, string> = {
  AVAILABLE: "Verfügbar",
  RESERVED: "Reserviert",
  INSPECTION: "Prüfung",
  DEFECTIVE: "Defekt",
};

const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  PURCHASE_RECEIPT: "Wareneingang",
  CONSIGNMENT_RECEIPT: "Konsignationszugang",
  SALE_OUT: "Verkauf",
  RESERVE: "Reservierung",
  RELEASE_RESERVATION: "Reservierung aufgehoben",
  RETURN_RECEIPT: "Kundenretoure eingegangen",
  RETURN_RESTOCK: "Kundenretoure eingelagert",
  RETURN_DEFECTIVE: "Kundenretoure als defekt gebucht",
  SUPPLIER_RETURN_OUT: "Lieferantenretoure versendet",
  ADJUSTMENT_IN: "Bestandszugang korrigiert",
  ADJUSTMENT_OUT: "Bestandsabgang korrigiert",
  REVERSAL: "Buchung storniert",
};

export function inventoryBucketLabel(value: InventoryBucket | null): string {
  return value ? INVENTORY_BUCKET_LABELS[value] : "";
}

export function inventoryMovementLabel(value: InventoryMovementType): string {
  return INVENTORY_MOVEMENT_LABELS[value];
}
