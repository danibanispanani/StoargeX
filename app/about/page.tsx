import type { Metadata } from "next";
import Link from "next/link";
import {
  PlaceholderNotice,
  PublicPageHeader,
  PublicShell,
} from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About | StoargeX",
  description:
    "Warum StoargeX als operative Warenwirtschaft für kleine Händlerteams entsteht.",
};

export default function AboutPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="About"
        title="Gebaut für Handel, der aus Tabellen herausgewachsen ist."
        description="StoargeX richtet Einkauf, Bestand, Verkauf, Retoure und Auszahlung als eine lesbare Spur aus – für Teams zwischen Tabellenchaos und Enterprise-ERP."
      />

      <section className="public-container grid gap-6 pb-16 lg:grid-cols-[1fr_0.75fr]">
        <div className="public-ledger-panel p-6 sm:p-8">
          <p className="public-section-kicker">Produktlogik</p>
          <div className="mt-6 grid gap-4">
            {[
              ["Einkauf", "Wareneingänge werden nicht als isolierte Zeilen behandelt."],
              ["Bestand", "Jede Veränderung soll als Bewegung nachvollziehbar bleiben."],
              ["Verkauf", "Order, Marge und Bestand hängen an derselben Geschichte."],
              ["Retoure", "Rückläufer sind ein normaler Prozesspfad, kein Randfall."],
              ["Auszahlung", "Am Ende muss klar sein, was wem zusteht."],
            ].map(([label, text]) => (
              <div
                key={label}
                className="grid gap-2 border-b border-rail/10 pb-4 last:border-0 last:pb-0"
              >
                <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-stamp">
                  {label}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <aside id="kontakt" className="space-y-4 scroll-mt-24">
          <PlaceholderNotice>
            Kontakt- und Unternehmensangaben sind bewusst als Struktur
            vorbereitet. Finale Inhalte müssen vom Betreiber ergänzt und geprüft
            werden.
          </PlaceholderNotice>
          <div className="public-track-card p-6">
            <p className="public-section-kicker">Kontakt</p>
            <h2 className="mt-3 font-display text-2xl font-semibold">
              Fragen zur Einführung?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Beschreibt euren Sonderfall im integrierten Fragebereich oder legt
              direkt den ersten gemeinsamen Arbeitsstand an.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild className="rounded-md">
                <Link href="/#question">Frage vorbereiten</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-md">
                <Link href="/registrieren">Organisation gründen</Link>
              </Button>
            </div>
          </div>
        </aside>
      </section>
    </PublicShell>
  );
}
