// Gemeinsame Definitionen für Import & Export.
// Aliasse decken die Original-Sheets ab: VKÜ 2026, VKÜ 2024/2025, Lager,
// Schulden, Retouren, Aufgaben und Pattfield.

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
  aliases: string[];
}

export interface TableDef {
  label: string;
  fields: FieldDef[];
}

export const IMPORT_TABLES: Record<TableKey, TableDef> = {
  lager: {
    label: "Lager",
    fields: [
      field("lagerid", "LagerID", ["lagerid", "lager-id", "lager id", "sku", "id"]),
      field("datum", "Datum", ["datum", "kaufdatum", "date"]),
      field("haendler", "Händler", ["händler", "haendler", "dealer", "lieferant"]),
      field("model", "Model", ["model", "modell", "artikel", "titel", "name"], true),
      field("colorway", "Colorway/Version", ["colorway", "colorway/version", "version", "variante", "farbe"]),
      field("size", "Size", ["size", "größe", "groesse", "gr"]),
      field("brutto", "Brutto", ["brutto", "ek brutto", "ek", "preis", "einkaufspreis"], true),
      field("vst", "VST", ["vst", "vorsteuer", "vorsteuerabzug"]),
      field("netto", "Netto", ["netto", "ek netto"]),
      field("zm", "ZM", ["zm", "zahlungsmethode", "zahlung"]),
      field("kauf", "Kauf", ["kauf", "kauf-status", "kaufstatus"]),
      field("retoure", "Retoure", ["retoure", "retoure-status", "retourestatus"]),
      field("status", "Status", ["status"]),
      field("ean", "EAN", ["ean", "gtin", "barcode"]),
      field("bilder", "Bilder", ["bilder", "bild", "image", "images"]),
      field("ka", "KA", ["ka", "kleinanzeigen"]),
      field("vinted", "Vinted", ["vinted"]),
      field("ebay_d", "eBay D", ["ebay d", "ebay_d", "ebay daniel"]),
      field("ebay_r", "eBay R", ["ebay r", "ebay_r", "ebay richard"]),
      field("sonstiges", "Sonstiges", ["sonstiges", "sonstige plattform"]),
      field("rechnung", "Rechnungsnr", ["rechnungsnr", "rechnung", "invoice"]),
      field("gruppierung", "Gruppierung", ["gruppierung", "gruppe", "group"]),
      field("kommentar", "Kommentar", ["kommentar", "notiz", "anmerkung", "notes"]),
    ],
  },
  verkauf: {
    label: "Verkauf",
    fields: [
      field("orderid", "OrderID", ["orderid", "order-id", "order id", "bestellnummer", "id"]),
      field("datum", "Verkaufsdatum", ["verkaufsdatum", "verkaufs- datum", "verkaufs datum", "datum", "date"]),
      field("lagerids", "LagerID(s)", ["lagerid(s)", "lagerids", "lagerid", "lager-id", "sku"]),
      field("model", "Model", ["model", "modell", "artikel", "titel"]),
      field("colorway", "Colorway/Version", ["colorway", "colorway/version", "version", "variante"]),
      field("size", "Größe", ["größe", "groesse", "size", "gr"]),
      field("menge", "Menge", ["menge", "m", "anzahl", "quantity"]),
      field("vk_brutto", "VK brutto", ["vk brutto", "vk_brutto", "vk", "verkaufspreis", "brutto"], true),
      field("steuern", "Steuern", ["steuern", "steuer", "tax"]),
      field("vk_netto", "VK Netto", ["vk netto", "vk_netto", "netto"]),
      field("ek_netto", "EK netto", ["ek netto", "ek_netto", "ek"]),
      field("gebuehren_brutto", "Plattformgebühren brutto", ["plattformgebühren brutto", "gebühren brutto", "gebühren", "gebuehren", "fees"]),
      field("gebuehren_netto", "Gebühren Netto", ["gebühren netto", "gebuehren netto", "fees net"]),
      field("versand_netto", "Versand Netto", ["versand netto", "versand", "versandkosten"]),
      field("gmarge", "GMarge", ["gmarge", "marge", "gross margin"]),
      field("gewinn", "Gewinn", ["gewinn", "profit"]),
      field("plattform", "Plattform", ["plattform", "platform"]),
      field("portoart", "Portoart", ["portoart", "versandart", "carrier"]),
      field("land", "Land", ["land", "country", "käuferland", "kaeuferland"]),
      field("auszahlung", "Auszahlung", ["auszahlung", "auszahlungsempfänger", "empfänger"]),
      field("gesamtstatus", "Gesamtstatus", ["gesamtstatus", "status"]),
      field("rechnung", "Rechnung", ["rechnung", "invoice"]),
      field("kommentar", "Kommentar", ["kommentar", "notiz", "anmerkung"]),
    ],
  },
  retouren: {
    label: "Retouren",
    fields: [
      field("orderid", "OrderID des Verkaufs", ["orderid", "order-id", "order id", "verkauf", "id"], true),
      field("datum", "Meldedatum", ["meldedatum", "datum", "date"]),
      field("lagerid", "LagerID", ["lagerid", "lager-id", "sku"]),
      field("verkaufsdatum", "Verkaufsdatum", ["verkaufsdatum"]),
      field("model", "Model", ["model", "modell", "artikel"]),
      field("colorway", "Variante", ["variante", "version", "colorway"]),
      field("size", "Größe", ["größe", "groesse", "size"]),
      field("menge", "Menge", ["menge", "quantity"]),
      field("problem", "Problemart", ["art des problems", "problemart", "problem"]),
      field("erstattung", "Erstattungsbetrag", ["erstattungsbetrag", "erstattung", "refund"]),
      field("zusatzkosten", "Zusatzkosten", ["zusatzkosten", "rückversand", "rueckversand"]),
      field("verlust", "Verlust", ["verlust", "loss"]),
      field("status", "Status Ware", ["status ware", "status"]),
      field("rechnungskorrektur", "Rechnungskorrektur", ["rechnungskorrektur"]),
      field("porto", "Porto", ["porto"]),
      field("plattform", "Plattform", ["plattform", "platform"]),
      field("ursache", "Ursache", ["ursache", "grund", "cause", "reason"]),
      field("kommentar", "Kommentar", ["kommentar", "notiz", "anmerkung"]),
    ],
  },
  konsignation: {
    label: "Konsignation",
    fields: [
      field("nr", "Nr.", ["nr.", "nr", "nummer"]),
      field("sku", "SKU", ["sku", "id", "lagerid"]),
      field("partner", "Partnerfirma", ["partnerfirma", "partner", "firma", "einlieferer"]),
      field("bezeichnung", "Bezeichnung", ["bezeichnung", "artikelbezeichnung"]),
      field("artikel", "Artikel", ["artikel", "artikelbezeichnung", "model", "titel", "name"]),
      field("name", "Name", ["name"]),
      field("sonstiges", "Sonstiges", ["sonstiges", "variante", "version"]),
      field("ean", "EAN", ["ean"]),
      field("identifikationsnr", "Identifikationsnr.", ["identifikationsnr.", "identifikationsnr", "identifikationsnummer"]),
      field("kategorie", "Kategorie", ["kategorie", "category"]),
      field("mm_stk", "MM Stk.", ["mm stk.", "mm stk", "mm_stk"]),
      field("lager", "Lager", ["lager"]),
      field("verkauft", "Verkauft", ["verkauft", "sold"]),
      field("retoure", "Retoure", ["retoure", "retourniert"]),
      field("defekt", "Defekt", ["defekt", "defective"]),
      field("restlager", "Restlager", ["restlager", "rest lager", "bestand", "quantity"]),
      field("ek_brutto", "EK Brutto", ["ek brutto", "ek_brutto"]),
      field("ek_netto", "EK Netto", ["ek netto", "ek_netto"]),
      field("endbetrag", "Endbetrag", ["endbetrag"]),
      field("versand", "Versand", ["versand"]),
      field("reale_ovp", "Reale OVP", ["reale ovp", "reale_ovp", "ovp"]),
      field("kommentar", "Kommentar", ["kommentar", "notiz", "anmerkung"]),
    ],
  },
  schulden: {
    label: "Schulden",
    fields: [
      field("datum", "Datum", ["datum", "date"]),
      field("refid", "ID", ["id", "refid", "lagerid", "orderid"]),
      field("beschreibung", "Artikelbeschreibung", ["artikelbeschreibung", "beschreibung", "artikel"], true),
      field("art", "Art", ["art", "typ", "kind"]),
      field("menge", "Menge", ["menge", "anzahl", "quantity"]),
      field("betrag", "Betrag", ["betrag", "summe", "amount"], true),
      field("schuldner", "Schuldner", ["schuldner", "debtor"], true),
      field("empfaenger", "Empfänger", ["empfänger", "empfaenger", "gläubiger", "glaeubiger", "creditor"], true),
      field("status", "Status", ["status"]),
      field("eintrag", "Eintrag", ["eintrag", "buchung"]),
      field("beglichen", "Begleichungsdatum", ["begleichungsdatum", "beglichen am", "beglichen"]),
      field("kommentar", "Kommentar", ["kommentar", "notiz", "anmerkung"]),
    ],
  },
  aufgaben: {
    label: "Aufgaben",
    fields: [
      field("aufgabe", "Aufgabe", ["aufgabe", "titel", "task"], true),
      field("zustaendig", "Zuständig", ["zuständig", "zustaendig", "assignee"]),
      field("frist", "Frist", ["frist", "deadline", "fällig", "faellig"]),
      field("bereich", "Bereich", ["bereich", "area", "kategorie"]),
      field("prioritaet", "Priorität", ["priorität", "prioritaet", "prio", "priority"]),
      field("status", "Status", ["status"]),
      field("anmerkung", "Anmerkung", ["anmerkung", "beschreibung", "kommentar", "notiz"]),
    ],
  },
};

function field(key: string, label: string, aliases: string[], required = false): FieldDef {
  return { key, label, required, aliases };
}

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

export function autoMapColumns(
  fields: FieldDef[],
  fileHeaders: string[]
): Record<string, string | null> {
  const normalized = fileHeaders.map((header) => ({ raw: header, norm: normalizeHeader(header) }));
  const mapping: Record<string, string | null> = {};
  for (const field of fields) {
    const match = normalized.find(
      (header) => header.norm === field.key || field.aliases.includes(header.norm)
    );
    mapping[field.key] = match?.raw ?? null;
  }
  return mapping;
}

export function detectHeaderRowIndex(fields: FieldDef[], rows: unknown[][]): number {
  const aliases = new Set(fields.flatMap((field) => [field.key, ...field.aliases]).map(normalizeHeader));
  let bestIndex = 0;
  let bestScore = -1;
  rows.forEach((row, index) => {
    const score = row.filter((cell) => aliases.has(normalizeHeader(String(cell ?? "")))).length;
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestIndex;
}
