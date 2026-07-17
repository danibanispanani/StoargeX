import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { getFeatureAccess } from "@/lib/feature-access";
import { FEATURE_KEYS } from "@/lib/services/feature-entitlement-service";
import { hasMinRole } from "@/lib/roles";
import { IMPORT_TABLES } from "@/lib/import-export";
import { IMPORT_CENTER_MODULES } from "@/lib/data-portability/catalog";
import { ImportCenterControls } from "@/components/import-export/import-export-bar";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ImportCenterPage() {
  const context = await requireOrg("MEMBER");
  const { db, membership } = context;
  const [history, consignmentAccess] = await Promise.all([
    db.importBatch.findMany({
      include: { _count: { select: { sourceReferences: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    getFeatureAccess(context, FEATURE_KEYS.CONSIGNMENT),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Daten / Eingang"
        title="Import Center"
        description="Vorlage → Mapping → Dry Run → Review → bestätigter Import. Jeder Commit bleibt über ImportBatch und SourceReference nachvollziehbar."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/importe">Konflikte prüfen</Link>
          </Button>
        }
      />

      <section aria-labelledby="import-modules-heading" className="border-y">
        <div className="grid gap-2 border-b bg-muted/35 px-3 py-2 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(14rem,1.3fr)_minmax(12rem,1fr)_auto]">
          <h2 id="import-modules-heading" className="font-mono text-[11px] font-semibold uppercase tracking-wider">
            Importmodule
          </h2>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:block">Auflösung</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:block">Vertrag</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:block">Aktion</span>
        </div>
        {IMPORT_CENTER_MODULES.map((module) => {
          const definition = IMPORT_TABLES[module.table];
          const required = definition.fields.filter((field) => field.required).length;
          const consignmentBlocked =
            module.table === "konsignation" && !consignmentAccess.enabled;
          const feeRulesBlocked =
            module.table === "gebuehrenregeln" && !hasMinRole(membership.role, "ADMIN");
          return (
            <article
              key={module.table}
              className="grid gap-3 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(14rem,1.3fr)_minmax(12rem,1fr)_auto] sm:items-center"
            >
              <div>
                <h3 className="font-medium">{module.label}</h3>
                <Link href={module.route} className="text-xs text-teal-700 underline-offset-4 hover:underline dark:text-teal-300">
                  Fachmodul öffnen
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">{module.relationshipHint}</p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant="outline">{definition.fields.length} Spalten</Badge>
                <Badge variant="outline">{required} Pflichtfelder</Badge>
                <Badge variant="outline">CSV / XLSX</Badge>
              </div>
              <div className="sm:justify-self-end">
                {consignmentBlocked ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/einstellungen">Add-on aktivieren</Link>
                  </Button>
                ) : feeRulesBlocked ? (
                  <span className="text-xs text-muted-foreground">ADMIN erforderlich</span>
                ) : (
                  <ImportCenterControls table={module.table} />
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="import-history-heading" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="import-history-heading" className="font-display text-lg font-semibold">Importhistorie</h2>
            <p className="text-sm text-muted-foreground">Die letzten 15 bestätigten oder fehlgeschlagenen Läufe dieser Organisation.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Dry Runs schreiben keinen Verlauf</span>
        </div>
        <div className="overflow-x-auto border">
          <table className="sx-datatable min-w-[52rem] w-full">
            <thead>
              <tr>
                <th>Datei / Modul</th>
                <th>Status</th>
                <th>Gestartet</th>
                <th>Beendet</th>
                <th>Provenienzzeilen</th>
                <th>Batch-ID</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? history.map((batch) => (
                <tr key={batch.id}>
                  <td><span className="block font-medium">{batch.fileName}</span><span className="text-xs text-muted-foreground">{batch.importType}</span></td>
                  <td><Badge variant={batch.status === "FAILED" ? "destructive" : "outline"}>{batch.status}</Badge></td>
                  <td>{batch.startedAt.toLocaleString("de-DE")}</td>
                  <td>{batch.finishedAt?.toLocaleString("de-DE") ?? "–"}</td>
                  <td className="font-mono">{batch._count.sourceReferences}</td>
                  <td className="font-mono text-xs">{batch.id}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Noch keine bestätigten Importe.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
