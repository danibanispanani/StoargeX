// Gemeinsame Definitionen für Import & Export (client- und server-tauglich).
// Die Aliasse decken die Spaltennamen der Original-Excel-Sheets ab
// (VKÜ 2026, VKÜ 20242025, Lager, Schulden, Retouren, Aufgaben, Pattfield).

export type TableKey =
  | "lager"
  | "verkauf"
  | "retouren"
  | "konsignation"
  | "schulden"
  | "aufgaben";

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[]; // lowercase-Vergleich
}

export interface TableDef {
  label: string;
  fields: FieldDef[];
}

export const IMPORT_TABLES: Record<TableKey, TableDef> = {
  lager: {
    label: "Lager",
    fields: [
      { key: "lagerid", label: "LagerID", aliases: ["lagerid", "lager-id", "lager id", "sku", "id"] },
      { key: "datum", label: "Datum", aliases: ["datum", "kaufdatum", "date"] },
      { key: "haendler", label: "Händler", aliases: ["händler", "haendler", "dealer", "lieferant"] },
      { key: "model", label: "Model", required: true, aliases: ["model", "modell", "artikel", "titel", "name"] },
      { key: "colorway", label: "Colorway/Version", aliases: ["colorway", "colorway/version", "version", "variante", "farbe"] },
      { key: "size", label: "Size", aliases: ["size", "größe", "groesse", "gr"] },
      { key: "brutto", label: "Brutto", required: true, aliases: ["brutto", "ek brutto", "ek", "preis", "einkaufspreis"] },
      { key: "vst", label: "VST", aliases: ["vst", "vorsteuer", "vorsteuerabzug"] },
      { key: "zm", label: "ZM", aliases: ["zm", "zahlungsmethode", "zahlung"] },
      { key: "kauf", label: "Kauf", aliases: ["kauf", "kauf-status", "kaufstatus"] },
      { key: "retoure", label: "Retoure", aliases: ["retoure", "retoure-status", "retourestatus"] },
      { key: "status", label: "Status", aliases: ["status"] },
      { key: "ean", label: "EAN", aliases: ["ean", "gtin", "barcode"] },
      { key: "kommentar", label: "Kommentar", aliases: ["kommentar", "notiz", "anmerkung", "notes"] },
    ],
  },
  verkauf: {
    label: "Verkauf",
    fields: [
      { key: "orderid", label: "OrderID", aliases: ["orderid", "order-id", "order id", "bestellnummer", "id"] },
      { key: "datum", label: "Verkaufsdatum", aliases: ["verkaufsdatum", "datum", "date"] },
      { key: "lagerids", label: "LagerID(s)", aliases: ["lagerid(s)", "lagerids", "lagerid", "lager-id", "sku"] },
      { key: "model", label: "Model", aliases: ["model", "modell", "artikel", "titel"] },
      { key: "vk_brutto", label: "VK brutto", required: true, aliases: ["vk brutto", "vk_brutto", "vk", "verkaufspreis", "brutto"] },
      { key: "ek_netto", label: "EK netto", aliases: ["ek netto", "ek_netto", "ek"] },
      { key: "gebuehren_brutto", label: "Plattformgebühren brutto", aliases: ["plattformgebühren brutto", "gebühren brutto", "gebühren", "gebuehren", "fees"] },
      { key: "versand", label: "Versand netto", aliases: ["versand netto", "versand", "versandkosten"] },
      { key: "plattform", label: "Plattform", aliases: ["plattform", "platform"] },
      { key: "versandart", label: "Versandart", aliases: ["versandart", "carrier"] },
      { key: "land", label: "Land", aliases: ["land", "country", "käuferland", "kaeuferland"] },
      { key: "auszahlung", label: "Auszahlung", aliases: ["auszahlung", "auszahlungsempfänger", "empfänger"] },
      { key: "status", label: "Gesamtstatus", aliases: ["gesamtstatus", "status"] },
      { key: "rechnung", label: "Rechnung", aliases: ["rechnung", "invoice"] },
      { key: "kommentar", label: "Kommentar", aliases: ["kommentar", "notiz", "anmerkung"] },
    ],
  },
  retouren: {
    label: "Retouren",
    fields: [
      { key: "orderid", label: "OrderID des Verkaufs", required: true, aliases: ["orderid", "order-id", "order id", "verkauf", "id"] },
      { key: "datum", label: "Meldedatum", aliases: ["meldedatum", "datum", "date"] },
      { key: "grund", label: "Grund", aliases: ["grund", "reason"] },
      { key: "erstattung", label: "Erstattungsbetrag", aliases: ["erstattungsbetrag", "erstattung", "refund"] },
      { key: "zusatzkosten", label: "Zusatzkosten", aliases: ["zusatzkosten", "rückversand", "rueckversand"] },
      { key: "status", label: "Status", aliases: ["status"] },
      { key: "kommentar", label: "Kommentar", aliases: ["kommentar", "notiz", "anmerkung"] },
    ],
  },
  konsignation: {
    label: "Konsignation",
    fields: [
      { key: "sku", label: "SKU", aliases: ["sku", "id", "lagerid"] },
      { key: "partner", label: "Partnerfirma", required: true, aliases: ["partnerfirma", "partner", "firma", "einlieferer"] },
      { key: "artikel", label: "Artikel", required: true, aliases: ["artikel", "artikelbezeichnung", "model", "titel", "name"] },
      { key: "bestand", label: "Bestand", aliases: ["bestand", "menge", "quantity"] },
      { key: "verkauft", label: "Verkauft", aliases: ["verkauft", "sold"] },
      { key: "retourniert", label: "Retourniert", aliases: ["retourniert", "retoure"] },
      { key: "defekt", label: "Defekt", aliases: ["defekt", "defective"] },
      { key: "kommentar", label: "Kommentar", aliases: ["kommentar", "notiz", "anmerkung"] },
    ],
  },
  schulden: {
    label: "Schulden",
    fields: [
      { key: "datum", label: "Datum", aliases: ["datum", "date"] },
      { key: "refid", label: "ID", aliases: ["id", "refid", "lagerid", "orderid"] },
      { key: "beschreibung", label: "Artikelbeschreibung", required: true, aliases: ["artikelbeschreibung", "beschreibung", "artikel"] },
      { key: "art", label: "Art", aliases: ["art", "typ", "kind"] },
      { key: "menge", label: "Menge", aliases: ["menge", "anzahl", "quantity"] },
      { key: "betrag", label: "Betrag", required: true, aliases: ["betrag", "summe", "amount"] },
      { key: "schuldner", label: "Schuldner", required: true, aliases: ["schuldner", "debtor"] },
      { key: "empfaenger", label: "Empfänger", required: true, aliases: ["empfänger", "empfaenger", "gläubiger", "glaeubiger", "creditor"] },
      { key: "status", label: "Status", aliases: ["status"] },
      { key: "eintrag", label: "Eintrag", aliases: ["eintrag", "buchung"] },
      { key: "beglichen", label: "Begleichungsdatum", aliases: ["begleichungsdatum", "beglichen am", "beglichen"] },
      { key: "kommentar", label: "Kommentar", aliases: ["kommentar", "notiz", "anmerkung"] },
    ],
  },
  aufgaben: {
    label: "Aufgaben",
    fields: [
      { key: "aufgabe", label: "Aufgabe", required: true, aliases: ["aufgabe", "titel", "task"] },
      { key: "zustaendig", label: "Zuständig", aliases: ["zuständig", "zustaendig", "assignee"] },
      { key: "frist", label: "Frist", aliases: ["frist", "deadline", "fällig", "faellig"] },
      { key: "bereich", label: "Bereich", aliases: ["bereich", "area", "kategorie"] },
      { key: "prioritaet", label: "Priorität", aliases: ["priorität", "prioritaet", "prio", "priority"] },
      { key: "status", label: "Status", aliases: ["status"] },
      { key: "anmerkung", label: "Anmerkung", aliases: ["anmerkung", "beschreibung", "kommentar", "notiz"] },
    ],
  },
};

/** Header-Namen normalisieren für den Alias-Vergleich. */
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Automatisches Mapping: App-Feld -> Spaltenname der Datei (oder null). */
export function autoMapColumns(
  fields: FieldDef[],
  fileHeaders: string[]
): Record<string, string | null> {
  const normalized = fileHeaders.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping: Record<string, string | null> = {};
  for (const field of fields) {
    const match = normalized.find(
      (h) => h.norm === field.key || field.aliases.includes(h.norm)
    );
    mapping[field.key] = match?.raw ?? null;
  }
  return mapping;
}
