import type { Metadata } from "next";
import {
  PlaceholderNotice,
  PublicPageHeader,
  PublicShell,
} from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Impressum | StoargeX",
  description: "Impressumsstruktur für StoargeX.",
};

export default function ImpressumPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Rechtliches"
        title="Impressum"
        description="Öffentliche Anbieterkennzeichnung für StoargeX. Die finale juristische Fassung muss vom Betreiber ergänzt und geprüft werden."
      />

      <section className="public-container pb-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <PlaceholderNotice>
            Platzhalterstruktur: Bitte keine produktive Veröffentlichung ohne
            finale Anbieterangaben und juristische Prüfung.
          </PlaceholderNotice>

          <article className="public-track-card public-legal-prose p-6 sm:p-8">
            <h2>Anbieter</h2>
            <p>[Name/Firma des Betreibers]</p>
            <p>[Straße und Hausnummer]</p>
            <p>[PLZ und Ort]</p>

            <h2>Vertreten durch</h2>
            <p>[Vertretungsberechtigte Person(en)]</p>

            <h2>Kontakt</h2>
            <p>E-Mail: [E-Mail-Adresse]</p>
            <p>Telefon: [Telefonnummer, falls vorgesehen]</p>

            <h2>Register und Umsatzsteuer</h2>
            <ul>
              <li>Registergericht: [falls vorhanden]</li>
              <li>Registernummer: [falls vorhanden]</li>
              <li>Umsatzsteuer-ID: [falls vorhanden]</li>
            </ul>

            <h2>Verantwortlich nach § 18 Abs. 2 MStV</h2>
            <p>[Name und Anschrift, falls erforderlich]</p>

            <h2>Hinweis</h2>
            <p>
              Diese Seite stellt nur die Design- und Informationsstruktur bereit.
              Rechtsverbindliche Inhalte werden nicht automatisch erzeugt.
            </p>
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
