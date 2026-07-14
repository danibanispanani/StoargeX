// Gemeinsame Definitionen für Import & Export.
// Aliasse decken die Original-Sheets ab: VKÜ 2026, VKÜ 2024/2025, Lager,
// Schulden, Retouren, Aufgaben und Pattfield.

export const TABLE_KEYS = [
  "produkte",
  "einkauf",
  "wareneingang",
  "lager",
  "verkauf",
  "retouren",
  "konsignation",
  "schulden",
  "aufgaben",
] as const;

export type TableKey = (typeof TABLE_KEYS)[number];

export function isTableKey(value: string): value is TableKey {
  return (TABLE_KEYS as readonly string[]).includes(value);
}

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
  description?: string;
  format?: string;
  example?: string;
}

export interface TableDef {
  label: string;
  fields: FieldDef[];
  example?: Record<string, string>;
}

export const IMPORT_TABLES: Record<TableKey, TableDef> = {
  produkte: {
    label: "Produkte",
    fields: [
      field("name", "Name", ["name", "produkt", "artikel", "model"], true, {
        description: "Eindeutiger Produktname innerhalb der Organisation.",
        format: "Text, max. 300 Zeichen",
        example: "Fire TV Stick",
      }),
      field("variant", "Variante", ["variante", "version", "colorway"], false, {
        description: "Optionale Ausführung oder Produktversion.",
        format: "Text, max. 200 Zeichen",
        example: "4K Max",
      }),
      field("brand", "Marke", ["marke", "brand", "hersteller"], false, {
        description: "Optionale Marke oder Herstellerbezeichnung.",
        format: "Text",
        example: "Amazon",
      }),
      field("category", "Kategorie", ["kategorie", "category", "gruppe"], false, {
        description: "Operative Produktkategorie für Filter und Bulk-Zuordnung.",
        format: "Text, max. 100 Zeichen",
        example: "Elektronik",
      }),
      field("ean", "EAN", ["ean", "gtin", "barcode"], false, {
        description: "Optionale numerische EAN/GTIN ohne Leerzeichen.",
        format: "Nur Ziffern, max. 20 Stellen",
        example: "840080588582",
      }),
      field("standard_ek", "Standard-EK", ["standard-ek", "standard ek", "default ek", "ek"], false, {
        description: "Optionaler Standard-Einkaufspreis brutto.",
        format: "Dezimalzahl in EUR, z. B. 34,99",
        example: "34,99",
      }),
      field("size", "Größe", ["größe", "groesse", "size"], false, {
        description: "Optionale Größen- oder Maßangabe.",
        format: "Text",
        example: "Standard",
      }),
      field("bilder", "Bilder", ["bilder", "bild", "images", "image urls"], false, {
        description: "Optionale öffentliche Bild-URLs, durch Komma getrennt.",
        format: "HTTPS-URLs, kommagetrennt",
        example: "https://example.com/fire-tv.jpg",
      }),
    ],
  },
  einkauf: {
    label: "Einkäufe",
    example: { datum: "14.07.2026", lieferant: "Beispiellieferant", artikel: "Fire TV Stick", menge: "2", preis: "34,99", zahlungsmethode: "Firma" },
    fields: [
      field("bestellnummer", "Bestellnummer", ["bestellnummer", "einkaufsnummer", "purchase number"], false, { description: "Optionale Lieferanten-Bestellnummer zum Gruppieren mehrerer Positionen.", format: "Text", example: "PO-2026-1042" }),
      field("datum", "Datum", ["datum", "bestelldatum", "purchase date", "date"], true, { description: "Bestelldatum.", format: "TT.MM.JJJJ oder JJJJ-MM-TT", example: "14.07.2026" }),
      field("lieferant", "Lieferant", ["lieferant", "händler", "haendler", "supplier", "vendor"], true, { description: "Lieferantenname; Stammdaten werden nicht automatisch erzwungen.", format: "Text", example: "Beispiellieferant" }),
      field("artikel", "Artikel", ["artikel", "produkt", "model", "name"], true, { description: "Produktname oder Artikelbezeichnung.", format: "Text", example: "Fire TV Stick" }),
      field("variante", "Variante", ["variante", "version", "colorway"], false, { description: "Optionale Produktvariante.", format: "Text", example: "4K Max" }),
      field("menge", "Menge", ["menge", "anzahl", "quantity"], true, { description: "Bestellte Stückzahl.", format: "Positive Ganzzahl", example: "2" }),
      field("preis", "Preis brutto", ["preis", "brutto", "ek", "einkaufspreis"], true, { description: "Brutto-Stückpreis.", format: "EUR-Dezimalzahl", example: "34,99" }),
      field("vst", "Vorsteuer", ["vst", "vorsteuer", "vorsteuerabzug"], false, { description: "Ob Vorsteuer abziehbar ist.", format: "Ja/Nein", example: "Ja" }),
      field("zahlungsmethode", "Zahlungsmethode", ["zahlungsmethode", "zahlung", "zm"], false, { description: "Historischer oder konfigurierter Zahlungs-Snapshot.", format: "Text", example: "Firma" }),
      field("erwartet", "Erwartete Lieferung", ["erwartet", "lieferdatum", "expected delivery"], false, { description: "Optional erwartetes Lieferdatum.", format: "TT.MM.JJJJ oder JJJJ-MM-TT", example: "18.07.2026" }),
      field("tracking", "Trackingnummer", ["tracking", "trackingnummer"], false, { description: "Optionale Sendungskennung.", format: "Text", example: "003404341234" }),
      field("notiz", "Notiz", ["notiz", "kommentar", "notes"], false, { description: "Optionale Einkaufsnotiz.", format: "Text", example: "Onlinebestellung" }),
    ],
  },
  wareneingang: {
    label: "Wareneingänge",
    example: { datum: "18.07.2026", lieferant: "Beispiellieferant", artikel: "Fire TV Stick", menge: "2", preis: "34,99", zustand: "NEW" },
    fields: [
      field("einkaufsnummer", "Einkaufsnummer", ["einkaufsnummer", "purchase number", "storagex einkauf"], false, { description: "Optionale StorageX-Einkaufsnummer für Eingang gegen Bestellung; leer erzeugt einen direkten Zugang.", format: "E-YY-NNNN", example: "E-26-0042" }),
      field("datum", "Datum", ["datum", "eingangsdatum", "date"], true, { description: "Tatsächliches Eingangsdatum.", format: "TT.MM.JJJJ oder JJJJ-MM-TT", example: "18.07.2026" }),
      field("lieferant", "Lieferant", ["lieferant", "händler", "haendler", "supplier", "vendor"], true, { description: "Lieferant oder Freitext-Fallback.", format: "Text", example: "Beispiellieferant" }),
      field("artikel", "Artikel", ["artikel", "produkt", "model", "name"], true, { description: "Artikelbezeichnung.", format: "Text", example: "Fire TV Stick" }),
      field("variante", "Variante", ["variante", "version", "colorway"], false, { description: "Optionale Produktvariante.", format: "Text", example: "4K Max" }),
      field("menge", "Menge", ["menge", "anzahl", "quantity"], true, { description: "Eingegangene Stückzahl.", format: "Positive Ganzzahl", example: "2" }),
      field("preis", "Preis brutto", ["preis", "brutto", "ek", "einkaufspreis"], true, { description: "Brutto-Stückpreis für direkte Zugänge.", format: "EUR-Dezimalzahl", example: "34,99" }),
      field("vst", "Vorsteuer", ["vst", "vorsteuer", "vorsteuerabzug"], false, { description: "Ob Vorsteuer abziehbar ist.", format: "Ja/Nein", example: "Ja" }),
      field("zahlungsmethode", "Zahlungsmethode", ["zahlungsmethode", "zahlung", "zm"], false, { description: "Zahlungs-Snapshot für direkte Zugänge.", format: "Text", example: "Firma" }),
      field("zustand", "Zustand", ["zustand", "condition"], false, { description: "Zentraler Artikelzustand.", format: "NEW, OPEN_BOX, REFURBISHED, USED oder DEFECTIVE", example: "NEW" }),
      field("pruefung", "Prüfung", ["prüfung", "pruefung", "inspection"], false, { description: "Ergebnis der Eingangsprüfung.", format: "PASSED, PENDING oder DEFECTIVE", example: "PASSED" }),
      field("rueckgabefrist", "Rückgabefrist", ["rückgabefrist", "rueckgabefrist", "return deadline"], false, { description: "Explizite Rückgabefrist.", format: "TT.MM.JJJJ oder JJJJ-MM-TT", example: "17.08.2026" }),
      field("tracking", "Trackingnummer", ["tracking", "trackingnummer"], false, { description: "Optionale Sendungskennung.", format: "Text", example: "003404341234" }),
      field("notiz", "Notiz", ["notiz", "kommentar", "notes"], false, { description: "Optionale Eingangsnotiz.", format: "Text", example: "Verpackung unbeschädigt" }),
    ],
  },
  lager: {
    label: "Lager",
    example: { lagerid: "L-26-001", datum: "13.07.2026", model: "Fire TV Stick", brutto: "34,99" },
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
    example: { orderid: "ORDER-1001", datum: "13.07.2026", model: "Fire TV Stick", vk_brutto: "59,99" },
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
    example: { orderid: "ORDER-1001", datum: "14.07.2026", erstattung: "59,99" },
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
    example: { nr: "1", sku: "K-26-001", partner: "Beispielpartner", artikel: "12V Ersatzakku", restlager: "5" },
    fields: [
      field("nr", "Nr.", ["nr.", "nr", "nummer"]),
      field("sku", "SKU", ["sku", "id", "lagerid"]),
      field("partner", "Partnerfirma", ["partnerfirma", "partner", "firma", "einlieferer"]),
      field("bezeichnung", "Bezeichnung", ["bezeichnung", "artikelbezeichnung"]),
      field("marke", "Marke", ["marke", "brand", "hersteller"]),
      field("artikel", "Artikel", ["artikel", "artikelbezeichnung", "model", "titel", "name"]),
      field("name", "Name", ["name"]),
      field("sonstiges", "Sonstiges", ["sonstiges", "variante", "version"]),
      field("ean", "EAN", ["ean"]),
      field("identifikationsnr", "Identifikationsnr.", ["identifikationsnr.", "identifikationsnr", "identifikationsnummer", "indifikationsnr.", "indifikationsnr"]),
      field("kategorie", "Kategorie", ["kategorie", "category"]),
      field("mm_stk", "MM Stk.", ["mm stk.", "mm stk", "mm_stk"]),
      field("lager", "Lager", ["lager"]),
      field("verkauft", "Verkauft", ["verkauft", "sold"]),
      field("retoure", "Retoure", ["retoure", "retourniert"]),
      field("defekt", "Defekt", ["defekt", "defective"]),
      field("restlager", "Restlager", ["restlager", "rest lager", "bestand", "quantity"]),
      field("ek_brutto", "EK Brutto", ["ek brutto", "ek_brutto", "brutto ek", "brutto_ek"]),
      field("ek_netto", "EK Netto", ["ek netto", "ek_netto", "netto ek", "netto_ek"]),
      field("endbetrag", "Endbetrag", ["endbetrag"]),
      field("versand", "Versand", ["versand"]),
      field("reale_ovp", "Reale OVP", ["reale ovp", "reale_ovp", "ovp"]),
      field("kommentar", "Kommentar", ["kommentar", "notiz", "anmerkung"]),
    ],
  },
  schulden: {
    label: "Schulden",
    example: { datum: "13.07.2026", beschreibung: "Wareneinkauf", betrag: "100,00", schuldner: "Firma", empfaenger: "Gesellschafter" },
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
    example: { aufgabe: "Wareneingang prüfen", frist: "14.07.2026", bereich: "Lager", prioritaet: "Mittel", status: "Offen" },
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

function field(
  key: string,
  label: string,
  aliases: string[],
  required = false,
  metadata: Pick<FieldDef, "description" | "format" | "example"> = {}
): FieldDef {
  return { key, label, required, aliases, ...metadata };
}

export function hasBlockingImportReview(
  summary?: { reviewRequired: number; conflicts: number } | null
): boolean {
  return Boolean(summary && (summary.reviewRequired > 0 || summary.conflicts > 0));
}

export function encodeSpreadsheetSafeText(value: string): string {
  if (value.startsWith("'")) return `'${value}`;
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function decodeSpreadsheetSafeText(value: string): string {
  if (value.startsWith("''")) return value.slice(1);
  return /^'[\t\r ]*[=+\-@]/.test(value) ? value.slice(1) : value;
}

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s*\*$/, "").replace(/\s+/g, " ");
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

export type ImportTemplateKind = "empty" | "example";

export interface ImportTemplate {
  table: TableKey;
  label: string;
  headers: string[];
  fields: FieldDef[];
  rows: Array<Record<string, string>>;
  descriptions: Array<{
    Spalte: string;
    Pflichtfeld: "Ja" | "Nein";
    Beschreibung: string;
    Format: string;
    Beispiel: string;
  }>;
}

export function buildImportTemplate(
  table: TableKey,
  kind: ImportTemplateKind
): ImportTemplate {
  const definition = IMPORT_TABLES[table];
  return {
    table,
    label: definition.label,
    fields: definition.fields,
    headers: definition.fields.map((item) =>
      item.required ? `${item.label} *` : item.label
    ),
    rows:
      kind === "example"
        ? [
            Object.fromEntries(
              definition.fields.map((item) => [
                item.key,
                definition.example?.[item.key] ?? item.example ?? "",
              ])
            ),
          ]
        : [],
    descriptions: definition.fields.map((item) => ({
      Spalte: item.label,
      Pflichtfeld: item.required ? "Ja" : "Nein",
      Beschreibung: item.description ?? `${item.label} gemäß Moduldefinition.`,
      Format: item.format ?? "Text",
      Beispiel: definition.example?.[item.key] ?? item.example ?? "",
    })),
  };
}

export function renderImportTemplateCsv(template: ImportTemplate): string {
  const lines = [
    template.headers.map(csvCell).join(";"),
    ...template.rows.map((row) =>
      template.fields.map((item) => csvCell(row[item.key] ?? "")).join(";")
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function csvCell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
