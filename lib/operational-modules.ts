import type { OperationalColumnOption } from "@/components/table/operational-table-workspace";

export interface OperationalModuleView {
  value: string;
  label: string;
}

export interface OperationalModuleDefinition {
  key: string;
  route: string;
  views: readonly OperationalModuleView[];
  columns: readonly OperationalColumnOption[];
  defaultVisibleColumns: readonly string[];
}

function defineModule(
  definition: OperationalModuleDefinition
): OperationalModuleDefinition {
  return definition;
}

export const OPERATIONAL_MODULES = {
  stock: defineModule({
    key: "lager",
    route: "/lager",
    views: [
      { value: "standard", label: "Standard" },
      { value: "stock", label: "Bestand" },
      { value: "purchasing", label: "Einkauf" },
      { value: "listings", label: "Listings" },
      { value: "inspection", label: "Prüfung/Defekt" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "selection", label: "Auswahl", required: true, filterable: false },
      { key: "number", label: "Lager-Nr.", required: true },
      { key: "date", label: "Datum" },
      { key: "product", label: "Artikel", required: true },
      { key: "quantity", label: "Bestand" },
      { key: "cost", label: "EK netto" },
      { key: "payment", label: "Zahlungsmethode" },
      { key: "purchase", label: "Kaufstatus" },
      { key: "return", label: "Retourenstatus" },
      { key: "status", label: "Bestandsstatus" },
      { key: "listings", label: "Listings" },
      { key: "ean", label: "EAN" },
      { key: "image", label: "Bild" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "selection",
      "number",
      "date",
      "product",
      "quantity",
      "cost",
      "payment",
      "status",
      "listings",
      "actions",
    ],
  }),
  purchasing: defineModule({
    key: "einkauf",
    route: "/einkauf",
    views: [
      { value: "standard", label: "Standard" },
      { value: "open", label: "Offen" },
      { value: "in-transit", label: "Unterwegs" },
      { value: "received", label: "Eingetroffen" },
      { value: "deadlines", label: "Rückgabefristen" },
      { value: "finance", label: "Finanzen" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "selection", label: "Auswahl", required: true, filterable: false },
      { key: "number", label: "Einkaufsnummer", required: true },
      { key: "supplier", label: "Lieferant", required: true },
      { key: "dates", label: "Termine" },
      { key: "status", label: "Status" },
      { key: "receipt", label: "Eingang" },
      { key: "finance", label: "Finanzen" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "selection",
      "number",
      "supplier",
      "dates",
      "status",
      "receipt",
      "actions",
    ],
  }),
  sales: defineModule({
    key: "verkauf",
    route: "/verkauf",
    views: [
      { value: "standard", label: "Standard" },
      { value: "finances", label: "Finanzen" },
      { value: "shipping", label: "Versand" },
      { value: "payout", label: "Auszahlung" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "number", label: "Order-ID", required: true },
      { key: "date", label: "Datum" },
      { key: "items", label: "Artikel", required: true },
      { key: "quantity", label: "Menge" },
      { key: "gross", label: "VK brutto" },
      { key: "tax", label: "Steuern" },
      { key: "net", label: "VK netto" },
      { key: "cost", label: "EK netto" },
      { key: "fees", label: "Gebühren" },
      { key: "shippingCost", label: "Versandkosten" },
      { key: "profit", label: "Gewinn" },
      { key: "margin", label: "Marge" },
      { key: "platform", label: "Plattform/Account" },
      { key: "status", label: "Status" },
      { key: "invoice", label: "Rechnung" },
      { key: "shipping", label: "Versand" },
      { key: "country", label: "Land" },
      { key: "payout", label: "Auszahlung" },
      { key: "debt", label: "Schuldstatus" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "number",
      "date",
      "platform",
      "items",
      "gross",
      "profit",
      "status",
      "invoice",
      "shipping",
      "actions",
    ],
  }),
  customerReturns: defineModule({
    key: "kundenretouren",
    route: "/retouren/kunden",
    views: [
      { value: "standard", label: "Standard" },
      { value: "inspection", label: "Prüfung" },
      { value: "finances", label: "Finanzen" },
      { value: "refund", label: "Erstattung" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "number", label: "R-Nummer", required: true },
      { key: "reported", label: "Meldedatum" },
      { key: "sale", label: "Verkauf" },
      { key: "items", label: "Artikel", required: true },
      { key: "quantity", label: "Menge" },
      { key: "reason", label: "Problem" },
      { key: "refund", label: "Erstattung" },
      { key: "costs", label: "Zusatzkosten" },
      { key: "loss", label: "Verlust" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "number",
      "reported",
      "sale",
      "items",
      "quantity",
      "reason",
      "loss",
      "status",
      "actions",
    ],
  }),
  supplierReturns: defineModule({
    key: "lieferantenretouren",
    route: "/retouren/lieferanten",
    views: [
      { value: "standard", label: "Standard" },
      { value: "deadlines", label: "Rückgabefristen" },
      { value: "shipping", label: "Versand" },
      { value: "refund", label: "Erstattung" },
      { value: "conflicts", label: "Konflikte" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "number", label: "LR-Nummer", required: true },
      { key: "purchase", label: "Einkauf/Lieferant" },
      { key: "items", label: "Positionen", required: true },
      { key: "quantity", label: "Menge" },
      { key: "deadline", label: "Frist" },
      { key: "shipping", label: "Versand" },
      { key: "expected", label: "Erwartet" },
      { key: "actual", label: "Tatsächlich/Differenz" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "number",
      "purchase",
      "items",
      "quantity",
      "deadline",
      "status",
      "actions",
    ],
  }),
  consignment: defineModule({
    key: "konsignation",
    route: "/konsignation",
    views: [
      { value: "standard", label: "Standard" },
      { value: "partner", label: "Partner" },
      { value: "stock", label: "Bestand" },
      { value: "sales", label: "Verkauf" },
      { value: "payout", label: "Auszahlung" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "number", label: "K-Nummer", required: true },
      { key: "partner", label: "Partner" },
      { key: "product", label: "Artikel", required: true },
      { key: "available", label: "Bestand" },
      { key: "sold", label: "Verkauft" },
      { key: "inspection", label: "Prüfung" },
      { key: "defective", label: "Defekt" },
      { key: "cost", label: "EK/Auszahlung" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "number",
      "partner",
      "product",
      "available",
      "sold",
      "cost",
      "status",
      "actions",
    ],
  }),
  debts: defineModule({
    key: "schulden",
    route: "/schulden",
    views: [
      { value: "standard", label: "Standard" },
      { value: "accounting", label: "Buchhaltung" },
      { value: "due", label: "Fälligkeiten" },
      { value: "settled", label: "Beglichen" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "date", label: "Datum" },
      { key: "number", label: "SCH-Nummer", required: true },
      { key: "reference", label: "Bezug" },
      { key: "description", label: "Beschreibung", required: true },
      { key: "due", label: "Fällig am" },
      { key: "type", label: "Art" },
      { key: "quantity", label: "Menge" },
      { key: "amount", label: "Betrag" },
      { key: "debtor", label: "Schuldner" },
      { key: "creditor", label: "Empfänger" },
      { key: "status", label: "Status" },
      { key: "entry", label: "Eintrag" },
      { key: "settledAt", label: "Beglichen am" },
      { key: "notes", label: "Kommentar" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "date",
      "number",
      "reference",
      "description",
      "amount",
      "debtor",
      "creditor",
      "status",
      "actions",
    ],
  }),
  shipping: defineModule({
    key: "versand",
    route: "/versand",
    views: [
      { value: "standard", label: "Standard" },
      { value: "active", label: "Aktiv" },
      { value: "inactive", label: "Inaktiv" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "carrier", label: "Dienstleister", required: true },
      { key: "rate", label: "Tarif", required: true },
      { key: "zone", label: "Zone" },
      { key: "countries", label: "Länder" },
      { key: "weight", label: "Gewichtsklasse" },
      { key: "base", label: "Grundpreis" },
      { key: "perKg", label: "Kilopreis" },
      { key: "surcharges", label: "Zuschläge" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "carrier",
      "rate",
      "zone",
      "countries",
      "weight",
      "base",
      "status",
      "actions",
    ],
  }),
  imports: defineModule({
    key: "importe",
    route: "/importe",
    views: [{ value: "all", label: "Alle" }],
    columns: [
      { key: "status", label: "Status", required: true },
      { key: "source", label: "Importquelle", required: true },
      { key: "row", label: "Zeile" },
      { key: "target", label: "Ziel" },
      { key: "legacyReference", label: "Legacyreferenz" },
      { key: "message", label: "Prüfhinweis" },
      { key: "actions", label: "Aktion", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "status",
      "source",
      "row",
      "target",
      "legacyReference",
      "message",
      "actions",
    ],
  }),
  credentials: defineModule({
    key: "zugangsdaten",
    route: "/zugangsdaten",
    views: [
      { value: "standard", label: "Standard" },
      { value: "platform", label: "Nach Plattform" },
      { value: "rotation", label: "Rotation" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "label", label: "Label", required: true },
      { key: "username", label: "Benutzername" },
      { key: "platform", label: "Plattform" },
      { key: "secret", label: "Secret", filterable: false },
      { key: "rotated", label: "Zuletzt geändert" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: [
      "label",
      "username",
      "platform",
      "secret",
      "rotated",
      "actions",
    ],
  }),
  team: defineModule({
    key: "team",
    route: "/team",
    views: [
      { value: "members", label: "Mitglieder" },
      { value: "invitations", label: "Einladungen" },
      { value: "roles", label: "Rollen" },
      { value: "all", label: "Alle" },
    ],
    columns: [
      { key: "name", label: "Name", required: true },
      { key: "email", label: "E-Mail", required: true },
      { key: "role", label: "Rolle" },
      { key: "expires", label: "Gültig bis" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Aktionen", required: true, filterable: false },
    ],
    defaultVisibleColumns: ["name", "email", "role", "status", "actions"],
  }),
} as const;

export function parseOperationalModuleView(
  definition: OperationalModuleDefinition,
  value: string | undefined
): string {
  return definition.views.some((view) => view.value === value)
    ? value!
    : definition.views[0]?.value ?? "standard";
}

export function operationalSearchParams(
  params: Record<string, string | undefined>
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return query.toString();
}

export function parseOperationalSearchQuery(value: string | undefined): string {
  return value?.trim().slice(0, 120) ?? "";
}

export function updateOperationalViewQuery(
  currentQuery: string,
  viewParam: string,
  nextView: string,
  defaultView: string
): string {
  const params = new URLSearchParams(currentQuery);
  if (nextView === defaultView) params.delete(viewParam);
  else params.set(viewParam, nextView);
  params.delete("page");
  return params.toString();
}

export function validateOperationalModuleDefinition(
  definition: OperationalModuleDefinition
): string[] {
  const errors: string[] = [];
  const columnKeys = definition.columns.map((column) => column.key);
  const viewKeys = definition.views.map((view) => view.value);

  if (new Set(columnKeys).size !== columnKeys.length) errors.push("duplicate columns");
  if (new Set(viewKeys).size !== viewKeys.length) errors.push("duplicate views");
  if (definition.defaultVisibleColumns.some((key) => !columnKeys.includes(key))) {
    errors.push("unknown default column");
  }
  if (
    definition.columns
      .filter((column) => column.required)
      .some((column) => !definition.defaultVisibleColumns.includes(column.key))
  ) {
    errors.push("required column hidden by default");
  }
  return errors;
}
