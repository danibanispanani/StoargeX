import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { PageToolbar } from "@/components/app/page-toolbar";
import { EmptyState } from "@/components/app/states";
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

export default async function ImportReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { db } = await requireOrg();
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
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Verwaltung / Datenqualität"
        title="Importkonflikte"
        description={`${totalResults} Review-Fälle · tenant-sicher aus ImportBatch und SourceReference`}
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
            {rows.length} von {totalResults} · maximal 100 aktuelle Fälle
          </span>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Keine Importkonflikte in dieser Ansicht"
          description="Es liegen keine Konflikte, Fehler, ungeklärten oder prüfpflichtigen SourceReferences für den aktuellen Filter vor."
        />
      ) : (
        <div className="overflow-x-auto border-y">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Importquelle</TableHead>
                <TableHead>Zeile</TableHead>
                <TableHead>Ziel</TableHead>
                <TableHead>Legacyreferenz</TableHead>
                <TableHead>Prüfhinweis</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const messages = [...row.errors, ...row.warnings];
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="border border-cargo-amber/50 bg-cargo-amber/10 px-2 py-0.5 font-mono text-[10px] font-semibold">
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-56 truncate text-sm font-medium">
                        {row.importBatch.fileName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {row.importBatch.importType}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.sheetName ? `${row.sheetName} · ` : ""}
                      {row.rowNumber}
                    </TableCell>
                    <TableCell>{importTargetLabel(row.targetEntity)}</TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-xs">
                      {row.legacyReference ?? "–"}
                    </TableCell>
                    <TableCell className="max-w-80">
                      <span className="block truncate text-xs">
                        {messages[0] ?? "Manuelle Zuordnung oder Prüfung erforderlich"}
                      </span>
                      {messages.length > 1 ? (
                        <span className="text-[11px] text-muted-foreground">
                          + {messages.length - 1} weitere Hinweise
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
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
        </div>
      )}
    </div>
  );
}
