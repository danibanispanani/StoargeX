import { describe, expect, it } from "vitest";
import {
  IMPORT_TABLES,
  TABLE_KEYS,
  autoMapColumns,
  buildImportTemplate,
  decodeSpreadsheetSafeText,
  encodeSpreadsheetSafeText,
  renderImportTemplateCsv,
} from "@/lib/import-export";

describe("import template standard", () => {
  it("defines a documented product template with required and formatted columns", () => {
    const product = IMPORT_TABLES.produkte;
    const name = product.fields.find((field) => field.key === "name");
    const price = product.fields.find((field) => field.key === "standard_ek");

    expect(name).toMatchObject({ required: true, format: "Text, max. 300 Zeichen" });
    expect(name?.description).toBeTruthy();
    expect(price).toMatchObject({ required: false, format: "Dezimalzahl in EUR, z. B. 34,99" });
  });

  it("creates empty and example templates plus a column description sheet", () => {
    const empty = buildImportTemplate("produkte", "empty");
    const example = buildImportTemplate("produkte", "example");

    expect(empty.rows).toEqual([]);
    expect(empty.headers[0]).toBe("Name *");
    expect(example.rows).toHaveLength(1);
    expect(example.rows[0].name).toBe("Fire TV Stick");
    expect(example.descriptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ Spalte: "Name", Pflichtfeld: "Ja" }),
        expect.objectContaining({ Spalte: "Standard-EK", Pflichtfeld: "Nein" }),
      ])
    );
  });

  it("renders Excel-compatible CSV and maps exported product headers back", () => {
    const template = buildImportTemplate("produkte", "example");
    const csv = renderImportTemplateCsv(template);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Name *;Variante");
    expect(autoMapColumns(IMPORT_TABLES.produkte.fields, template.headers)).toMatchObject({
      name: "Name *",
      variant: "Variante",
      standard_ek: "Standard-EK",
    });
  });

  it("provides a meaningful example row for every registered import table", () => {
    for (const table of TABLE_KEYS) {
      const template = buildImportTemplate(table, "example");
      const row = template.rows[0];
      expect(row).toBeDefined();
      expect(Object.values(row).some((value) => value.trim().length > 0)).toBe(true);
      for (const field of IMPORT_TABLES[table].fields.filter((item) => item.required)) {
        expect(row[field.key], `${table}.${field.key}`).not.toBe("");
      }
    }
  });

  it("round-trips spreadsheet-formula-like text without changing literal apostrophes", () => {
    for (const value of ["=1+1", "+49123", "-1", "@handle", "  =SUM(A1:A2)", "'literal"]) {
      expect(decodeSpreadsheetSafeText(encodeSpreadsheetSafeText(value))).toBe(value);
    }
  });
});
