import { NextResponse } from "next/server";
import { resolveApiOrgContext } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import {
  EXPORT_DATASETS,
  isExportDatasetKey,
  selectExportColumns,
} from "@/lib/data-portability/catalog";
import {
  filterPortableRows,
  loadExportDataset,
} from "@/lib/data-portability/export-datasets";
import { loadOrganizationPortableData } from "@/lib/data-portability/organization-data";
import {
  collectionToPortableRows,
  portableDownloadHeaders,
  renderPortableCsv,
  renderPortableWorkbook,
} from "@/lib/data-portability/render";

export const dynamic = "force-dynamic";
const DATASET_LIMIT = 50_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> }
) {
  const { dataset } = await params;
  const fullExport = dataset === "vollauszug";
  if (!fullExport && !isExportDatasetKey(dataset)) {
    return NextResponse.json({ error: "Unbekannter Datenauszug." }, { status: 404 });
  }

  const access = await resolveApiOrgContext(fullExport ? "OWNER" : "READONLY");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Nicht angemeldet." : "Keine Berechtigung." },
      { status: access.status }
    );
  }

  const { db, organization, userId } = access.context;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const date = new Date().toISOString().slice(0, 10);

  if (fullExport) {
    if (format !== "xlsx") {
      return NextResponse.json(
        { error: "Der vollständige Mehrtabellen-Auszug ist als XLSX verfügbar; einzelne Datensätze können als CSV geladen werden." },
        { status: 422 }
      );
    }
    const payload = await loadOrganizationPortableData(db, organization);
    const sheets = Object.entries(payload)
      .filter(([key]) => !["exportedAt", "format"].includes(key))
      .map(([name, value]) => ({ name, rows: collectionToPortableRows(value) }));
    sheets.unshift({
      name: "Manifest",
      rows: [{
        Format: payload.format,
        Exportiert_am: payload.exportedAt,
        Organisation: organization.name,
        Hinweis: "Credential-, Auth-, Token-, Passwort-, TOTP- und Recovery-Secrets sind ausgeschlossen.",
      }],
    });
    await writeAuditLog({
      organizationId: organization.id,
      userId,
      action: "organization.full_export",
      entityType: "Organization",
      entityId: organization.id,
      after: { format: "xlsx", datasets: sheets.length },
    });
    return new NextResponse(new Uint8Array(renderPortableWorkbook(sheets)), {
      headers: portableDownloadHeaders(
        `storagex-vollauszug-${organization.slug}-${date}`,
        "xlsx"
      ),
    });
  }

  const requestedColumns = url.searchParams
    .getAll("columns")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const query = url.searchParams.get("q") ?? "";
  const loaded = await loadExportDataset(db, dataset);
  const filtered = filterPortableRows(loaded, query);
  if (filtered.length > DATASET_LIMIT) {
    return NextResponse.json(
      { error: `Der synchrone Export ist auf ${DATASET_LIMIT} Zeilen begrenzt. Bitte Suche oder Fachfilter eingrenzen.` },
      { status: 422 }
    );
  }
  const rows = selectExportColumns(filtered, requestedColumns);
  const fileBase = `storagex-${dataset}-${date}`;

  if (format === "xlsx") {
    const label = EXPORT_DATASETS.find((item) => item.key === dataset)?.label ?? dataset;
    return new NextResponse(
      new Uint8Array(renderPortableWorkbook([{ name: label, rows }])),
      {
      headers: portableDownloadHeaders(fileBase, "xlsx"),
      }
    );
  }
  return new NextResponse(renderPortableCsv(rows), {
    headers: portableDownloadHeaders(fileBase, "csv"),
  });
}
