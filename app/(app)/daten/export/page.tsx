import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import {
  EXPORT_DATASET_COLUMNS,
  EXPORT_DATASETS,
} from "@/lib/data-portability/catalog";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ExportCenterPage() {
  const { membership } = await requireOrg();
  const isOwner = hasMinRole(membership.role, "OWNER");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Daten / Ausgang"
        title="Export Center"
        description="Operative CSV-/XLSX-Auszüge mit auswählbaren Spalten sowie ein vollständiger, relationaler Fachdatenauszug ohne Secrets."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/einstellungen#daten-dsgvo">DSGVO-JSON</Link>
          </Button>
        }
      />

      <section className="grid gap-3 border-y py-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="font-display text-lg font-semibold">Vollständiger Fachdatenauszug</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Eine XLSX-Arbeitsmappe mit aktuellem und kompatiblem Legacy-Kern, Relationen, Ledger,
            Importprovenienz, Partnern, Accounts, Aufgaben, Gebühren und Entitlements. Auth-, Token-,
            Passwort-, TOTP-, Recovery- und Credential-Secrets werden ausgeschlossen.
          </p>
        </div>
        <div className="flex items-center lg:justify-end">
          {isOwner ? (
            <Button asChild>
              <a href="/api/export-data/vollauszug?format=xlsx" download>Vollauszug XLSX</a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Vollauszug und DSGVO-Export erfordern OWNER.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="datasets-heading" className="space-y-3">
        <div>
          <h2 id="datasets-heading" className="font-display text-lg font-semibold">Fachdatensätze</h2>
          <p className="text-sm text-muted-foreground">
            Ohne Spaltenauswahl werden alle Spalten exportiert. Suche und Auswahl gelten nur für den jeweiligen Download.
          </p>
        </div>
        <div className="grid gap-px border bg-border xl:grid-cols-2">
          {EXPORT_DATASETS.map((dataset) => (
            <article key={dataset.key} className="bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{dataset.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{dataset.description}</p>
                </div>
                <Badge variant="outline">{EXPORT_DATASET_COLUMNS[dataset.key].length} Spalten</Badge>
              </div>
              <details className="mt-3 border-t pt-3">
                <summary className="cursor-pointer text-sm font-medium">Filter, Spalten und Format</summary>
                <form action={`/api/export-data/${dataset.key}`} method="get" className="mt-3 space-y-3">
                  <label className="block text-xs font-medium">
                    Suche in allen Exportfeldern
                    <input name="q" className="border-input mt-1 h-8 w-full border bg-background px-2 text-sm" placeholder="optional" />
                  </label>
                  <fieldset>
                    <legend className="text-xs font-medium">Spalten (leer = alle)</legend>
                    <div className="mt-1 grid max-h-36 gap-1 overflow-y-auto border p-2 sm:grid-cols-2">
                      {EXPORT_DATASET_COLUMNS[dataset.key].map((column) => (
                        <label key={column} className="flex items-center gap-2 text-xs">
                          <input type="checkbox" name="columns" value={column} />
                          <span>{column.replaceAll("_", " ")}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="format" value="csv" size="sm" variant="outline">CSV exportieren</Button>
                    <Button type="submit" name="format" value="xlsx" size="sm" variant="outline">XLSX exportieren</Button>
                  </div>
                </form>
              </details>
            </article>
          ))}
        </div>
      </section>

      <aside className="border-l-2 border-cargo-amber bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
        Aktive operative Filter und die Modulsortierung werden weiterhin über die Exportaktionen direkt in
        Lager, Einkauf, Produkte, Verkauf, Retouren, Konsignation, Schulden, Aufgaben und Ausgaben übernommen.
        Der Export Center ergänzt diese Roundtrip-Exporte um relationale Fachdatensätze.
      </aside>
    </div>
  );
}
