import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { resolveApiOrgContext } from "@/lib/org";
import { getFeatureAccess } from "@/lib/feature-access";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";
import {
  buildImportTemplate,
  isTableKey,
  renderImportTemplateCsv,
  type ImportTemplateKind,
} from "@/lib/import-export";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!isTableKey(table)) {
    return NextResponse.json({ error: "Unbekannte Importvorlage." }, { status: 404 });
  }

  const access = await resolveApiOrgContext();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Nicht angemeldet." : "Keine Berechtigung." },
      { status: access.status }
    );
  }
  if (table === "konsignation") {
    const featureAccess = await getFeatureAccess(access.context, FEATURE_KEYS.CONSIGNMENT);
    if (!featureAccess.enabled) {
      return NextResponse.json({ error: "Konsignation ist nicht aktiviert." }, { status: 403 });
    }
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const kind: ImportTemplateKind =
    url.searchParams.get("kind") === "example" ? "example" : "empty";
  const template = buildImportTemplate(table, kind);
  const fileBase = `storagex-${table}-${kind === "example" ? "beispiel" : "leer"}-vorlage`;

  if (format === "csv") {
    return new NextResponse(renderImportTemplateCsv(template), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
      },
    });
  }

  const importSheet = XLSX.utils.aoa_to_sheet([
    template.headers,
    ...template.rows.map((row) =>
      template.fields.map((field) => row[field.key] ?? "")
    ),
  ]);
  importSheet["!cols"] = template.fields.map((field) => ({
    wch: Math.min(42, Math.max(14, field.label.length + 4, field.example?.length ?? 0)),
  }));
  const descriptionSheet = XLSX.utils.json_to_sheet(template.descriptions);
  descriptionSheet["!cols"] = [
    { wch: 22 },
    { wch: 14 },
    { wch: 52 },
    { wch: 36 },
    { wch: 32 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, importSheet, "Import");
  XLSX.utils.book_append_sheet(workbook, descriptionSheet, "Spaltenbeschreibung");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
    },
  });
}
