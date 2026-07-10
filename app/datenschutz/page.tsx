import type { Metadata } from "next";
import {
  PlaceholderNotice,
  PublicPageHeader,
  PublicShell,
} from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Datenschutz | StoargeX",
  description: "Datenschutzstruktur für StoargeX.",
};

export default function DatenschutzPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Rechtliches"
        title="Datenschutz"
        description="Struktur für die Datenschutzhinweise der öffentlichen StoargeX-Oberfläche und der SaaS-Nutzung."
      />

      <section className="public-container pb-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <PlaceholderNotice>
            Platzhalterstruktur: Finale Datenschutztexte müssen anhand der
            tatsächlichen Anbieter, Hosting-, Zahlungs-, E-Mail- und
            Tracking-Konfiguration erstellt und geprüft werden.
          </PlaceholderNotice>

          <article className="public-track-card public-legal-prose p-6 sm:p-8">
            <h2>Verantwortlicher</h2>
            <p>[Name/Firma, Anschrift und Kontakt des Verantwortlichen]</p>

            <h2>Hosting und technische Bereitstellung</h2>
            <p>
              Beschreibung des Hostings, der Serverstandorte, Auftragsverarbeiter
              und technischen Logdaten ergänzen.
            </p>

            <h2>Authentifizierung und Nutzerkonto</h2>
            <p>
              Angaben zu Kontoerstellung, Login, Zwei-Faktor-Authentifizierung,
              Sessions und Rollen-/Organisationsdaten ergänzen.
            </p>

            <h2>Zahlung und Abrechnung</h2>
            <p>
              Zahlungsanbieter, Abonnementverwaltung und relevante
              Abrechnungsdaten ergänzen, sofern produktiv verwendet.
            </p>

            <h2>E-Mail-Kommunikation</h2>
            <p>
              SMTP-/E-Mail-Anbieter, Einladungen, Systemmails und Supportkontakt
              ergänzen.
            </p>

            <h2>Cookies und lokale Speicherung</h2>
            <p>
              Session-Cookies, Theme-Präferenzen und notwendige technische
              Speicherungen beschreiben.
            </p>

            <h2>Rechte betroffener Personen</h2>
            <ul>
              <li>Auskunft</li>
              <li>Berichtigung</li>
              <li>Löschung</li>
              <li>Einschränkung der Verarbeitung</li>
              <li>Datenübertragbarkeit</li>
              <li>Widerspruch</li>
            </ul>

            <h2>Aufbewahrung und Löschung</h2>
            <p>
              Konkrete Fristen für Organisationsdaten, Bewegungsdaten,
              Rechnungsdaten und Logs ergänzen.
            </p>
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
