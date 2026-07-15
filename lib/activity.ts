// Menschenlesbare Darstellung von AuditLog-Einträgen fürs Dashboard-Widget.

interface AuditPayload {
  sku?: string;
  skus?: string[];
  orderNumber?: string;
  title?: string;
  name?: string;
  label?: string;
  email?: string;
  role?: string;
  status?: string;
  kind?: string;
  table?: string;
  importedCount?: number;
  count?: number;
  tier?: string;
  debtor?: string;
  creditor?: string;
  purchaseNumber?: string;
  inventoryNumber?: string;
  saleNumber?: string;
  returnNumber?: string;
  debtNumber?: string;
  productName?: string;
}

export interface ActivityEntry {
  id: string;
  createdAt: Date;
  actorName: string;
  text: string;
  href: string | null;
}

/** Filter-Gruppen für das Aktionstyp-Dropdown. */
export const ACTIVITY_GROUPS: Array<{ prefix: string; label: string }> = [
  { prefix: "stock_item", label: "Lager" },
  { prefix: "sale", label: "Verkauf" },
  { prefix: "return", label: "Retouren" },
  { prefix: "supplier_return", label: "Lieferantenretouren" },
  { prefix: "debt", label: "Schulden" },
  { prefix: "task", label: "Aufgaben" },
  { prefix: "product", label: "Produkte" },
  { prefix: "consignment", label: "Konsignation" },
  { prefix: "shipping_rate", label: "Versand" },
  { prefix: "credential", label: "Zugangsdaten" },
  { prefix: "member", label: "Team" },
  { prefix: "user", label: "Login & Konto" },
  { prefix: "import", label: "Import" },
];

const ENTITY_ROUTES: Record<string, string> = {
  StockItem: "/lager",
  Sale: "/verkauf",
  Return: "/retouren/kunden",
  SupplierReturn: "/retouren/lieferanten",
  Debt: "/schulden",
  Task: "/aufgaben",
  Product: "/produkte",
  ConsignmentInventory: "/konsignation",
  InventoryPosition: "/lager",
  Purchase: "/lager",
  ShippingRate: "/versand",
  Credential: "/zugangsdaten",
  Membership: "/team",
  Invitation: "/team",
  Organization: "/einstellungen",
};

function ref(payload: AuditPayload): string {
  if (payload.skus?.length) {
    return payload.skus.length === 1
      ? payload.skus[0]
      : `${payload.skus[0]} – ${payload.skus[payload.skus.length - 1]}`;
  }
  return (
    payload.sku ??
    payload.purchaseNumber ??
    payload.inventoryNumber ??
    payload.saleNumber ??
    payload.returnNumber ??
    payload.debtNumber ??
    payload.orderNumber ??
    payload.label ??
    payload.name ??
    payload.title ??
    payload.email ??
    ""
  );
}

/** "hat Artikel L-26-042 eingetragen" etc. */
export function activityText(
  action: string,
  after: unknown,
  before: unknown
): string {
  const a = (after ?? {}) as AuditPayload;
  const b = (before ?? {}) as AuditPayload;
  const target = ref(a) || ref(b);

  const templates: Record<string, string> = {
    "stock_item.create": `hat Artikel ${target} eingetragen`,
    "stock_item.update": `hat Artikel ${ref(b) || target} bearbeitet`,
    "stock_item.status_change": `hat den Status eines Artikels auf „${a.status ?? "?"}“ geändert`,
    "stock_item.bulk_update": `hat ${a.count ?? "mehrere"} Artikel per Mehrfachbearbeitung aktualisiert`,
    "sale.create": `hat Verkauf ${target} gespeichert`,
    "sale.update": `hat Verkauf ${target} bearbeitet`,
    "return.create": `hat eine Retoure erfasst`,
    "return.update": `hat eine Retoure bearbeitet`,
    "return.status": `hat den Kundenretouren-Status auf „${a.status ?? "?"}“ gesetzt`,
    "supplier_return.create": `hat Lieferantenretoure ${a.returnNumber ?? target} geplant`,
    "supplier_return.status": `hat den Lieferantenretouren-Status auf „${a.status ?? "?"}“ gesetzt`,
    "debt.create": `hat einen Schulden-Eintrag angelegt (${a.debtor ?? "?"} → ${a.creditor ?? "?"})`,
    "debt.update": `hat einen Schulden-Eintrag bearbeitet`,
    "debt.settle": `hat eine Schuld als beglichen markiert`,
    "debt.status_change": `hat den Status eines Schulden-Eintrags geändert`,
    "debt.delete": `hat einen Schulden-Eintrag gelöscht`,
    "task.create": `hat Aufgabe „${a.title ?? target}“ angelegt`,
    "product.create": `hat Produkt „${target}“ angelegt`,
    "product.update": `hat Produkt „${target}“ bearbeitet`,
    "product.delete": `hat Produkt „${target}“ gelöscht`,
    "consignment.create": `hat Konsignationsartikel ${target} angelegt`,
    "consignment.counts_update": `hat Konsignations-Bestände aktualisiert`,
    "shipping_rate.create": `hat Versandtarif „${target}“ angelegt`,
    "shipping_rate.update": `hat Versandtarif „${target}“ bearbeitet`,
    "shipping_rate.delete": `hat Versandtarif „${target}“ gelöscht`,
    "credential.create": `hat Zugangsdaten „${target}“ gespeichert`,
    "credential.reveal": `hat Zugangsdaten „${target}“ abgerufen`,
    "credential.delete": `hat Zugangsdaten „${target}“ gelöscht`,
    "member.invite": `hat ${a.email ?? "jemanden"} eingeladen`,
    "member.invite_accept": `ist der Organisation beigetreten`,
    "member.role_change": `hat eine Rolle auf ${a.role ?? "?"} geändert`,
    "member.remove": `hat ein Mitglied entfernt`,
    "user.login": `hat sich angemeldet`,
    "user.2fa_enable": `hat 2FA aktiviert`,
    "organization.update": `hat die Firmendaten geändert`,
    "organization.export": `hat den Datenexport ausgeführt`,
    "billing.tier_change": `hat den Plan auf ${a.tier ?? "?"} geändert`,
    "import.run": `hat ${a.importedCount ?? "?"} Zeilen in „${a.table ?? "?"}“ importiert`,
    "purchase.create": `hat Wareneingang ${a.purchaseNumber ?? target} erfasst`,
    "owned_stock_lot.create": `hat Lagerbestand ${a.inventoryNumber ?? target} erfasst`,
    "owned_purchase.create_from_stock_form": `hat Wareneingang ${a.purchaseNumber ?? target} erfasst`,
    "owned_stock_lot.entry_status_change": `hat Status von ${a.inventoryNumber ?? target} geändert`,
    "consignment_lot.create": `hat Konsignationsbestand ${a.inventoryNumber ?? target} erfasst`,
    "sale.create_v2": `hat Verkauf ${a.saleNumber ?? target} abgeschlossen`,
    "sale.cancel_v2": `hat Verkauf ${a.saleNumber ?? target} storniert`,
    "return.create_v2": `hat Retoure ${a.returnNumber ?? target} erfasst`,
    "debt.create_purchase": `hat Schuld ${a.debtNumber ?? target} aus Einkauf ${a.purchaseNumber ?? ""} angelegt`,
    "debt.create_sale": `hat Schuld ${a.debtNumber ?? target} aus Verkauf ${a.saleNumber ?? ""} angelegt`,
    "inventory.movement": `hat eine Bestandsbewegung für ${a.inventoryNumber ?? target} gebucht`,
    "tax_rate.create": `hat einen Steuersatz angelegt`,
    "tax_rate.update": `hat einen Steuersatz geändert`,
  };

  return templates[action] ?? `hat die Aktion „${action}“ ausgeführt`;
}

export function activityHref(entityType: string | null): string | null {
  return entityType ? ENTITY_ROUTES[entityType] ?? null : null;
}
