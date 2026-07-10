import type { Metadata } from "next";
import {
  PlaceholderNotice,
  PublicPageHeader,
  PublicShell,
} from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "AGB | StoargeX",
  description: "AGB-Struktur für StoargeX.",
};

export default function AgbPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Rechtliches"
        title="AGB"
        description="Vorbereitete Struktur für Nutzungsbedingungen einer operativen Multi-Tenant-SaaS. Keine finale Rechtsfassung."
      />

      <section className="public-container pb-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <PlaceholderNotice>
            Platzhalterstruktur: Diese Seite enthält keine finalen AGB. Inhalte
            müssen passend zum Geschäftsmodell, Billing und Betreiber juristisch
            erstellt werden.
          </PlaceholderNotice>

          <article className="public-track-card public-legal-prose p-6 sm:p-8">
            <h2>Geltungsbereich</h2>
            <p>[Für wen und welche Nutzung diese Bedingungen gelten.]</p>

            <h2>Leistungsbeschreibung</h2>
            <p>
              Beschreibung der StoargeX-Leistung als SaaS für Einkauf, Bestand,
              Verkauf, Retoure, Auswertung und Teamarbeit ergänzen.
            </p>

            <h2>Nutzerkonto und Organisation</h2>
            <p>
              Regeln zu Registrierung, Organisationen, Rollen, Einladungen und
              Verantwortlichkeiten ergänzen.
            </p>

            <h2>Abos, Zahlung und Kündigung</h2>
            <p>
              Planmodelle, Testphasen, Zahlungsabwicklung, Laufzeiten und
              Kündigungsfristen ergänzen.
            </p>

            <h2>Pflichten der Kunden</h2>
            <p>
              Datenpflege, Zugangsschutz, rechtmäßige Nutzung und Verantwortung
              für eingetragene Handelsdaten ergänzen.
            </p>

            <h2>Verfügbarkeit und Änderungen</h2>
            <p>
              Wartung, Weiterentwicklung, Einschränkungen und Kommunikation von
              Änderungen ergänzen.
            </p>

            <h2>Haftung</h2>
            <p>[Haftungsregelungen juristisch formulieren lassen.]</p>

            <h2>Schlussbestimmungen</h2>
            <p>[Gerichtsstand, anwendbares Recht und sonstige Regelungen ergänzen.]</p>
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
