import type { TableKey } from "@/lib/import-export";

export interface ImportCenterModule {
  table: TableKey;
  label: string;
  route: string;
  relationshipHint: string;
}

export const IMPORT_CENTER_MODULES: readonly ImportCenterModule[] = [
  { table: "produkte", label: "Produkte", route: "/produkte", relationshipHint: "Name, EAN und SKU" },
  { table: "einkauf", label: "Einkauf", route: "/einkauf", relationshipHint: "Bestellnummer, Lieferant und Artikel" },
  { table: "lager", label: "Lager", route: "/lager", relationshipHint: "LagerID/SKU und Artikel" },
  { table: "verkauf", label: "Verkauf", route: "/verkauf", relationshipHint: "Externe Order-ID und LagerID" },
  { table: "kundenretouren", label: "Kundenretouren", route: "/retouren/kunden", relationshipHint: "Externe Order-ID" },
  { table: "lieferantenretouren", label: "Lieferantenretouren", route: "/retouren/lieferanten", relationshipHint: "Einkaufsnummer, LagerID und RMA" },
  { table: "konsignation", label: "Konsignation", route: "/konsignation", relationshipHint: "SKU und Partnername" },
  { table: "schulden", label: "Schulden", route: "/schulden", relationshipHint: "sichtbare Referenz und Parteien" },
  { table: "aufgaben", label: "Aufgaben", route: "/aufgaben", relationshipHint: "Bearbeiter-E-Mail und Fachobjektnummer" },
  { table: "ausgaben", label: "Ausgaben", route: "/finanzen/ausgaben", relationshipHint: "Partner-, Konto- und Plattformkontoname" },
  { table: "gebuehrenregeln", label: "Gebührenregeln", route: "/finanzen/gebuehren", relationshipHint: "Plattform und optionaler Accountname" },
] as const;

export const EXPORT_DATASETS = [
  { key: "inventory-ledger", label: "Inventory-Ledger", description: "Alle Bestandsbewegungen mit Position und Produkt." },
  { key: "purchases", label: "Purchases", description: "Einkaufsköpfe und Positionen." },
  { key: "sale-lines", label: "SaleLines / Allocations", description: "Verkaufspositionen und Bestandszuordnungen." },
  { key: "return-lines", label: "ReturnLines / Allocations", description: "Kundenretourenpositionen und Zuordnungen." },
  { key: "supplier-returns", label: "SupplierReturns", description: "Lieferantenretouren mit Positionen und Erstattungen." },
  { key: "expenses", label: "Expenses", description: "Einmalige und wiederkehrende Betriebsausgaben." },
  { key: "fee-rules", label: "FeeRules", description: "Versionierte Gebührenregeln und Quellenbezug." },
  { key: "tasks", label: "Tasks / Assignments", description: "Aufgaben, Zuweisungen und Checklistenfortschritt." },
  { key: "platform-accounts", label: "PlatformAccounts", description: "Plattformkonten ohne Credential-Secrets." },
  { key: "entitlements", label: "Entitlements", description: "Add-ons, Trials und manuelle Berechtigungen." },
] as const;

export const EXPORT_DATASET_COLUMNS: Record<ExportDatasetKey, readonly string[]> = {
  "inventory-ledger": ["LagerID", "Artikel", "EAN", "Bestandsart", "Bewegung", "Menge", "Von", "Nach", "Referenztyp", "Referenz-ID", "Gebucht_am"],
  purchases: ["Einkaufsnummer", "Lieferanten_Bestellnummer", "Bestelldatum", "Lieferant", "Artikel", "EAN", "Menge", "Stückpreis_brutto", "Gesamt_brutto", "Zahlungskonto", "Bestellstatus", "Versandstatus", "Rückgabefrist"],
  "sale-lines": ["Verkaufsnummer", "Verkaufsdatum", "Plattform", "Marktplatzkonto", "Artikel", "EAN", "Positionsmenge", "Betrag_brutto", "Betrag_netto", "LagerID", "Allokationsmenge", "EK_netto_Snapshot", "Bestandsart_Snapshot"],
  "return-lines": ["Retourennummer", "Verkaufsnummer", "Meldedatum", "Retourenstatus", "Artikel", "Menge", "Rückgabegrund", "Zustand", "Erstattung", "LagerID", "Allokationsmenge", "Eingangsbewegung", "Einlagerungsbewegung", "Defektbewegung"],
  "supplier-returns": ["LR_Nummer", "Einkaufsnummer", "Lieferant", "Status", "LagerID", "Artikel", "EAN", "Menge", "Bestands_Bucket", "Rückgabegrund", "Rückgabefrist", "RMA", "Trackingnummer", "Erwartete_Erstattung", "Tatsächliche_Erstattung", "Differenz"],
  expenses: ["Bezeichnung", "Kategorie", "Lieferant", "Betrag_brutto", "Betrag_netto", "Steuer_Prozent", "Zahlungsdatum", "Fälligkeit", "Zahlungskonto", "Marktplatzkonto", "Status", "Intervall", "Startdatum", "Enddatum"],
  "fee-rules": ["Plattform", "Marktplatzkonto", "Gebührenset", "Version", "Kategorie", "Artikelzustand", "Gültig_ab", "Gültig_bis", "Prozent", "Fix", "Minimum", "Maximum", "Werbegebühr_Prozent", "Zahlungsgebühr_Prozent", "USt_Behandlung", "Priorität", "Herkunft", "Quelle", "Aktiv"],
  tasks: ["Titel", "Beschreibung", "Bereich", "Priorität", "Status", "Frist", "Ersteller", "Umfang", "Bearbeiter", "Primär_verantwortlich", "Checklistenpunkte", "Checklistenpunkte_erledigt", "Archiviert", "Wiedervorlage"],
  "platform-accounts": ["Plattform", "Anzeigename", "Externe_Accountkennung", "Accounttyp", "Marktplatzcode", "Land", "Verkäuferprofil", "Shopmodell", "Steuerprofil", "Standardzustand", "Standard_Auszahlungskonto", "Standard_Gebührenset", "Gebührenset_Version", "Aktiv"],
  entitlements: ["Feature", "Status", "Herkunft", "Start", "Ende", "Externe_Referenz", "Erstellt_am", "Aktualisiert_am"],
};

export const EXPORT_DATASET_KEYS = EXPORT_DATASETS.map((dataset) => dataset.key);
export type ExportDatasetKey = (typeof EXPORT_DATASETS)[number]["key"];

export function isExportDatasetKey(value: string): value is ExportDatasetKey {
  return EXPORT_DATASET_KEYS.includes(value as ExportDatasetKey);
}

export const GDPR_REQUIRED_DATASETS = [
  "products",
  "purchases",
  "purchaseLines",
  "purchaseReceipts",
  "purchaseReceiptLines",
  "inventoryPositions",
  "ownedStockLots",
  "consignmentLots",
  "inventoryPositionListings",
  "inventoryMovements",
  "sales",
  "saleLines",
  "saleLineAllocations",
  "returns",
  "returnLines",
  "returnAllocations",
  "supplierReturns",
  "supplierReturnLines",
  "debts",
  "debtPurchaseLinks",
  "debtSaleLinks",
  "debtInventoryLinks",
  "importBatches",
  "sourceReferences",
  "expenses",
  "expenseRecurrenceRules",
  "businessPartners",
  "businessPartnerRoles",
  "marketplaceAccounts",
  "payoutAccounts",
  "feeSchedules",
  "feeRules",
  "feeCategories",
  "tasks",
  "taskAssignments",
  "taskChecklistItems",
  "taskActivities",
  "taskDomainLinks",
  "featureEntitlements",
  "legacySaleItems",
] as const;

const FORBIDDEN_EXPORT_KEYS = [
  "password",
  "passwordhash",
  "passphrase",
  "passwort",
  "kennwort",
  "secret",
  "secretencrypted",
  "apikey",
  "privatekey",
  "token",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "totpsecret",
  "recoverycodes",
  "wiederherstellungscodes",
  "authorization",
  "cookie",
] as const;

function isForbiddenExportKey(key: string): boolean {
  const normalized = key.replaceAll(/[_-]/g, "").toLowerCase();
  return FORBIDDEN_EXPORT_KEYS.some(
    (forbidden) => normalized === forbidden || normalized.endsWith(forbidden)
  );
}

export function sanitizePortableData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePortableData(item)) as T;
  }
  if (value instanceof Date || value === null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isForbiddenExportKey(key))
      .map(([key, item]) => [key, sanitizePortableData(item)])
  ) as T;
}

export type PortableRow = Record<string, string | number | boolean | null>;

export function selectExportColumns(
  rows: PortableRow[],
  requestedColumns: readonly string[]
): PortableRow[] {
  if (requestedColumns.length === 0) return rows;
  return rows.map((row) =>
    Object.fromEntries(
      requestedColumns
        .filter((column) => Object.hasOwn(row, column))
        .map((column) => [column, row[column]])
    )
  );
}
