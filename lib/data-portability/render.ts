import * as XLSX from "xlsx";
import { encodeSpreadsheetSafeText } from "@/lib/import-export";
import type { PortableRow } from "@/lib/data-portability/catalog";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function renderPortableCsv(rows: PortableRow[]): string {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const escape = (value: PortableRow[string]) => {
    const raw = typeof value === "string"
      ? encodeSpreadsheetSafeText(value)
      : String(value ?? "");
    return /[";\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
  };
  return `\uFEFF${[
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(";")),
  ].join("\r\n")}`;
}

export function renderPortableWorkbook(
  sheets: readonly { name: string; rows: PortableRow[] }[]
): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      safeSheetName(sheet.name, workbook.SheetNames)
    );
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function portableDownloadHeaders(
  filename: string,
  format: "csv" | "xlsx"
): Record<string, string> {
  return {
    "Content-Type": format === "xlsx" ? XLSX_MIME : "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}.${format}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

export function portableValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toJSON" in value && typeof value.toJSON === "function") {
    const json = value.toJSON();
    return typeof json === "object" ? JSON.stringify(json) : String(json);
  }
  return JSON.stringify(value);
}

export function collectionToPortableRows(value: unknown): PortableRow[] {
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { Wert: portableValue(item) };
    }
    return Object.fromEntries(
      Object.entries(item).map(([key, field]) => [key, portableValue(field)])
    );
  });
}

function safeSheetName(name: string, existing: readonly string[]): string {
  const base = name.replaceAll(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Daten";
  if (!existing.includes(base)) return base;
  for (let index = 2; index < 100; index++) {
    const suffix = `-${index}`;
    const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    if (!existing.includes(candidate)) return candidate;
  }
  throw new Error(`Kein eindeutiger XLSX-Sheetname für ${name}.`);
}
