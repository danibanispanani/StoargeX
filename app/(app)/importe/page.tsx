import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { PageToolbar } from "@/components/app/page-toolbar";
import { EmptyState } from "@/components/app/states";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IMPORT_REVIEW_STATUSES,
  importTargetHref,
  importTargetLabel,
} from "@/lib/imports/import-review";
import {
  OPERATIONAL_MODULES,
  operationalSearchParams,
} from "@/lib/operational-modules";
import { MAX_TABLE_PAGE_SIZE } from "@/lib/operational-table";

export default async function ImportReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { db, organization, userId } = await requireOrg();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const where = {
    status: { in: [...IMPORT_REVIEW_STATUSES] },
    ...(query
      ? {
          OR: [
            { legacyReference: { contains: query, mode: "insensitive" as const } },
            { importBatch: { fileName: { contains: query, mode: "insensitive" as const } } },
            { errors: { has: query } },
            { warnings: { has: query } },
          ],
        }
      : {}),
  };
  const [totalResults, rows] = await Promise.all([
    db.sourceReference.count({ where }),
    db.sourceReference.findMany({
      where,
      include: {
        importBatch: {
          select: { fileName: true, importType: true, startedAt: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { rowNumber: "asc" }],
      take: MAX_TABLE_PAGE_SIZE,
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Verwaltung / Datenqualität"
        title="Importkonflikte"
        description="Importkonflikte prüfen, zuordnen und nachvollziehbar abschließen."
      />
      <PageToolbar
        primary={
          <form action="/importe" className="flex min-w-0 flex-1 flex-wrap gap-2">
            <input type="hidden" name="status" value="konflikt" />
            <Input
              name="q"
              defaultValue={query}
              placeholder="Datei, Legacyreferenz oder exakte Meldung"
              aria-label="Importkonflikte durchsuchen"
              className="min-w-52 max-w-md flex-1"
            />
            <Button type="submit" variant="outline">
              Anwenden
            </Button>
          </form>
        }
        secondary={
          <span className="text-[11px] text-muted-foreground">
            {rows.length} von {totalResults} · maximal {MAX_TABLE_PAGE_SIZE} aktuelle Fälle
          </span>
        }
      />

      <CompactTableShell
        definition={OPERATIONAL_MODULES.imports}
        scope={{ organizationId: organization.id, userId }}
        currentQuery={operationalSearchParams({ q: query || undefined, status: params.status })}
        totalResults={totalResults}
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Keine Importkonflikte in dieser Ansicht"
            description="Es liegen keine Konflikte, Fehler, ungeklärten oder prüfpflichtigen SourceReferences für den aktuellen Filter vor."
          />
        ) : (
          <Table className="sx-datatable">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead data-column-key="status">Status</TableHead>
                <TableHead data-column-key="source">Importquelle</TableHead>
                <TableHead data-column-key="row">Zeile</TableHead>
                <TableHead data-column-key="target">Ziel</TableHead>
                <TableHead data-column-key="legacyReference">Legacyreferenz</TableHead>
                <TableHead data-column-key="message">Prüfhinweis</TableHead>
                <TableHead data-column-key="actions" className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const messages = [...row.errors, ...row.warnings];
                return (
                  <TableRow key={row.id} data-row-id={row.id}>
                    <TableCell data-column-key="status">
                      <span className="border border-cargo-amber/50 bg-cargo-amber/10 px-2 py-0.5 font-mono text-[10px] font-semibold">
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell data-column-key="source">
                      <span className="block max-w-56 truncate text-sm font-medium">
                        {row.importBatch.fileName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {row.importBatch.importType}
                      </span>
                    </TableCell>
                    <TableCell data-column-key="row" className="font-mono text-xs">
                      {row.sheetName ? `${row.sheetName} · ` : ""}
                      {row.rowNumber}
                    </TableCell>
                    <TableCell data-column-key="target">{importTargetLabel(row.targetEntity)}</TableCell>
                    <TableCell data-column-key="legacyReference" className="max-w-48 truncate font-mono text-xs">
                      {row.legacyReference ?? "–"}
                    </TableCell>
                    <TableCell data-column-key="message" className="max-w-80">
                      <span className="block truncate text-xs">
                        {messages[0] ?? "Manuelle Zuordnung oder Prüfung erforderlich"}
                      </span>
                      {messages.length > 1 ? (
                        <span className="text-[11px] text-muted-foreground">
                          + {messages.length - 1} weitere Hinweise
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell data-column-key="actions" className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={importTargetHref(
                            row.targetEntity,
                            row.legacyReference
                          )}
                        >
                          Fachobjekte öffnen
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CompactTableShell>
    </div>
  );
}
