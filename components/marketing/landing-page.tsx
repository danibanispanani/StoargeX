import type { ComponentType } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Barcode,
  Boxes,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Coins,
  FileSpreadsheet,
  Fingerprint,
  HandCoins,
  KeyRound,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  Route,
  ScanLine,
  ShieldCheck,
  ShoppingBasket,
  Tags,
  UsersRound,
  Warehouse,
} from "lucide-react";
import { TIERS } from "@/lib/billing";
import { formatEuro } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingFooter, MarketingNav } from "@/components/marketing/marketing-shell";
import { QuestionConsole } from "@/components/marketing/question-console";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const FLOW = [
  { code: "01", title: "Einkauf", Icon: ShoppingBasket, detail: "Beleg + EK" },
  { code: "02", title: "Bestand", Icon: PackageCheck, detail: "Position + Spur" },
  { code: "03", title: "Verkauf", Icon: Tags, detail: "Order + Marge" },
  { code: "04", title: "Retoure", Icon: RotateCcw, detail: "Rücklauf + Zustand" },
  { code: "05", title: "Auszahlung", Icon: Coins, detail: "Geld + Abschluss" },
] as const;

const WORKFLOW_DETAILS = [
  {
    number: "01",
    title: "Ware kommt an.",
    text: "Einkauf, Lieferant, Beleg und Einstandspreis werden als Ausgangspunkt derselben Geschichte erfasst.",
    meta: "Wareneingang",
  },
  {
    number: "02",
    title: "Bestand wird gebucht.",
    text: "Keine stille Zahl im Feld: Jede Veränderung läuft über eine nachvollziehbare Bestandsbewegung.",
    meta: "InventoryMovement",
  },
  {
    number: "03",
    title: "Verkauf verbindet alles.",
    text: "Order, Plattform, Steuer, Gebühren und Marge bleiben mit der ursprünglichen Ware verknüpft.",
    meta: "Order + Allocation",
  },
  {
    number: "04",
    title: "Retouren löschen nichts.",
    text: "Der Rückweg wird Teil der Spur: Zustand, Verlust, Wiedereinlagerung oder Defekt bleiben lesbar.",
    meta: "Return loop",
  },
  {
    number: "05",
    title: "Geld findet seinen Ursprung.",
    text: "Auszahlungen und offene Beträge lassen sich auf Geschäft, Ware und Verantwortlichkeit zurückführen.",
    meta: "Settlement",
  },
] as const;

const USE_CASES: Array<{
  eyebrow: string;
  title: string;
  text: string;
  Icon: IconComponent;
  rows: Array<[string, string]>;
  tone: "teal" | "amber" | "red" | "ink";
}> = [
  {
    eyebrow: "Eigener Bestand",
    title: "Vom Wareneingang bis zur echten Marge",
    text: "Für Teams, die über mehrere Plattformen handeln und trotzdem pro Artikel wissen wollen, was wirklich passiert ist.",
    Icon: Warehouse,
    rows: [["Position", "K-1048"], ["Bewegung", "SALE_OUT"], ["Status", "ausgezahlt"]],
    tone: "teal",
  },
  {
    eyebrow: "Konsignation",
    title: "Fremde Ware bleibt fremde Ware",
    text: "Einlieferer, Verkaufsanteil und Auszahlung werden nicht nachträglich in Tabellen auseinandergerechnet.",
    Icon: HandCoins,
    rows: [["Eigentümer", "Einlieferer"], ["Anteil", "regelbasiert"], ["Saldo", "offen"]],
    tone: "amber",
  },
  {
    eyebrow: "Retouren & Defekte",
    title: "Der Rückweg gehört zum Prozess",
    text: "Rücksendung, Zustand und finanzieller Effekt bleiben mit dem ursprünglichen Verkauf verbunden.",
    Icon: RotateCcw,
    rows: [["Rücklauf", "angekommen"], ["Zustand", "geprüft"], ["Folge", "wieder einlagern"]],
    tone: "red",
  },
  {
    eyebrow: "Team & Kontrolle",
    title: "Ein gemeinsamer Arbeitsstand",
    text: "Rollen, Aufgaben und sensible Aktionen sind sichtbar, ohne dass jede Person ihre eigene Wahrheit pflegt.",
    Icon: UsersRound,
    rows: [["Rolle", "Operator"], ["Prüfung", "2FA"], ["Nachweis", "Audit-Log"]],
    tone: "ink",
  },
];

const TRUST = [
  { title: "Mandantentrennung", text: "Organisationen arbeiten in getrennten Datenräumen.", Icon: Fingerprint },
  { title: "Auditierbare Aktionen", text: "Sensible Schritte hinterlassen einen nachvollziehbaren Eintrag.", Icon: ClipboardCheck },
  { title: "Pflicht-2FA für Admins", text: "Privilegierte Zugänge erhalten eine zusätzliche Kontrollstufe.", Icon: KeyRound },
  { title: "DSGVO-Export", text: "Daten können strukturiert und kontrolliert ausgegeben werden.", Icon: ShieldCheck },
] as const;

const FAQS = [
  ["Für wen ist StoargeX gedacht?", "Für kleine Handelsorganisationen und GbRs, die Ware über mehrere Kanäle bewegen und dafür mehr Zusammenhang als eine Tabellenmappe brauchen."],
  ["Kann ich kostenlos starten?", "Ja. Der Free-Tarif bildet den Einstieg für Lager, Verkauf, Retouren, Aufgaben und ein kleines Team ab."],
  ["Was passiert bei einer Retoure?", "Die Retoure bleibt mit dem Verkauf verbunden. Zustand, Verlust und eine mögliche Wiedereinlagerung werden als Teil des Warenflusses behandelt."],
  ["Wie funktioniert Konsignation?", "Konsignationsware bleibt einem Einlieferer zugeordnet. Verkauf, Anteil und Auszahlung können dadurch getrennt vom Eigenbestand nachvollzogen werden."],
  ["Wie schützt StoargeX Organisationsdaten?", "Die Oberfläche und Produktlogik sind auf Mandantentrennung, Rollen, 2FA, Audit-Log und kontrollierte Exporte ausgelegt."],
] as const;

function SectionIntro({
  index,
  eyebrow,
  title,
  text,
  inverted = false,
}: {
  index: string;
  eyebrow: string;
  title: string;
  text: string;
  inverted?: boolean;
}) {
  return (
    <div className="landing-section-intro">
      <div className="landing-section-index" aria-hidden="true">{index}</div>
      <div>
        <p className={inverted ? "landing-kicker text-cargo-amber" : "landing-kicker"}>{eyebrow}</p>
        <h2 className={inverted ? "text-fog" : undefined}>{title}</h2>
        <p className={inverted ? "text-fog/65" : "text-muted-foreground"}>{text}</p>
      </div>
    </div>
  );
}

function HeroLedger() {
  return (
    <div className="landing-hero-stage" aria-label="Operatives Ledger vom Einkauf bis zur Auszahlung">
      <div className="landing-board">
        <div className="landing-board-topline">
          <span>WARENFLUSS / LIVE</span>
          <span>ORG-01 · DE</span>
        </div>
        <div className="landing-board-route" aria-hidden="true">
          <span className="landing-route-line" />
          <span className="landing-route-pulse" />
        </div>
        <div className="landing-board-stations">
          {FLOW.map(({ code, title, Icon, detail }, index) => (
            <div key={title} className={`landing-board-station station-${index + 1}`}>
              <div className="landing-station-pin">
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <span className="landing-station-code">{code}</span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </div>
        <div className="landing-return-loop" aria-hidden="true">
          <RotateCcw className="size-4" />
          Rückspur
        </div>
        <div className="landing-ledger-ticket ticket-a">
          <span>POSITION</span>
          <strong>K-1048</strong>
          <small>EAN geprüft · Bestand +1</small>
        </div>
        <div className="landing-ledger-ticket ticket-b">
          <span>ORDER</span>
          <strong>VK-02371</strong>
          <small>Marge berechnet · bezahlt</small>
        </div>
        <div className="landing-board-stamp">VERBUCHT</div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="landing-page public-shell flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="public-container landing-hero-grid">
            <div className="landing-hero-copy">
              <Reveal>
                <div className="landing-signal-row">
                  <Route className="size-4" aria-hidden="true" />
                  Transit Ledger für Handelsorganisationen
                </div>
                <h1 id="landing-hero-title">
                  Jede Ware hat eine Spur.
                  <span>Bis das Geld ankommt.</span>
                </h1>
                <p className="landing-hero-lede">
                  StoargeX verbindet Einkauf, Bestand, Verkauf, Retoure und Auszahlung in einem operativen System – damit Zusammenhang nicht in Tabellen verloren geht.
                </p>
                <div className="landing-hero-actions">
                  <Button asChild size="lg" className="rounded-md px-6">
                    <Link href="/registrieren">Organisation gründen <ArrowRight className="ml-1 size-4" aria-hidden="true" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-md bg-transparent px-6 text-fog hover:bg-fog/10 hover:text-fog">
                    <Link href="#workflow">Warenfluss ansehen <ArrowDownRight className="ml-1 size-4" aria-hidden="true" /></Link>
                  </Button>
                </div>
              </Reveal>
            </div>
            <Reveal delay={120} className="landing-hero-visual-wrap">
              <HeroLedger />
            </Reveal>
          </div>
          <div className="landing-hero-rail" aria-hidden="true">
            <span>WARE</span><span>BELEG</span><span>BEWEGUNG</span><span>GELD</span><span>VERANTWORTUNG</span>
          </div>
        </section>

        <section id="problem" className="landing-section landing-problem scroll-mt-24">
          <div className="public-container">
            <Reveal>
              <SectionIntro index="01" eyebrow="Der Bruch" title="Tabellen zeigen Zeilen. Handel braucht Beziehungen." text="Wenn Ware, Beleg, Verkauf und Retoure in getrennten Listen leben, entsteht operative Reibung genau dort, wo Entscheidungen getroffen werden." />
            </Reveal>
            <div className="landing-problem-compare">
              <Reveal className="landing-chaos-sheet">
                <div className="landing-sheet-head"><FileSpreadsheet className="size-5" aria-hidden="true" /><span>lager_final_neu_03.xlsx</span></div>
                {["EK brutto?", "Status VK", "Retoure Alt", "Auszahlung offen", "Notiz Marco"].map((item, index) => (
                  <div className="landing-sheet-row" key={item}><span>{index + 18}</span><strong>{item}</strong><em>{index % 2 ? "prüfen" : "???"}</em></div>
                ))}
                <div className="landing-sheet-warning">5 Listen · 3 Wahrheiten · kein Verlauf</div>
              </Reveal>
              <div className="landing-compare-switch" aria-hidden="true"><ArrowRight className="size-5" /></div>
              <Reveal delay={120} className="landing-clear-ledger">
                <div className="landing-ledger-head"><ScanLine className="size-5" aria-hidden="true" /><span>K-1048 / vollständige Spur</span><BadgeCheck className="ml-auto size-5 text-transit-teal" aria-hidden="true" /></div>
                {[["Einkauf", "Beleg 2441", "erfasst"], ["Bestand", "ADJUSTMENT_IN", "+1"], ["Verkauf", "VK-02371", "−1"], ["Auszahlung", "Settlement 08", "geschlossen"]].map(([step, ref, state]) => (
                  <div className="landing-ledger-row" key={step}><span>{step}</span><strong>{ref}</strong><em>{state}</em></div>
                ))}
                <div className="landing-ledger-summary">Ein Objekt · eine Geschichte · klare Folge</div>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-section landing-workflow scroll-mt-24">
          <div className="public-container">
            <Reveal>
              <SectionIntro index="02" eyebrow="Produktmechanik" title="Fünf Kontrollpunkte. Eine fortlaufende Buchung." text="Der Warenfluss ist keine Illustration neben dem Produkt. Er ist das Ordnungsprinzip des Produkts." inverted />
            </Reveal>
            <div className="landing-workflow-track">
              {WORKFLOW_DETAILS.map((item, index) => (
                <Reveal key={item.number} delay={index * 60} className="landing-workflow-step">
                  <div className="landing-workflow-node"><span>{item.number}</span></div>
                  <p className="landing-workflow-meta">{item.meta}</p>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </Reveal>
              ))}
            </div>
            <Reveal className="landing-return-note">
              <RotateCcw className="size-5 text-customs-red" aria-hidden="true" />
              <span><strong>Retoure ist kein Sonderfall.</strong> Sie zeichnet eine Rückspur zum Bestand, ohne den ursprünglichen Verkauf zu überschreiben.</span>
            </Reveal>
          </div>
        </section>

        <section id="features" className="landing-section scroll-mt-24">
          <div className="public-container">
            <Reveal>
              <SectionIntro index="03" eyebrow="Arbeitslagen" title="Nicht Features sammeln. Situationen beherrschen." text="StoargeX ordnet typische Handelslagen nach Ware, Verantwortlichkeit und finanzieller Folge – mit dem jeweils passenden operativen Ausschnitt." />
            </Reveal>
            <div className="landing-use-cases">
              {USE_CASES.map(({ eyebrow, title, text, Icon, rows, tone }, index) => (
                <Reveal key={title} delay={index * 70} className={`landing-use-case tone-${tone}`}>
                  <div className="landing-use-case-copy">
                    <p>{eyebrow}</p>
                    <h3>{title}</h3>
                    <span>{text}</span>
                  </div>
                  <div className="landing-use-case-panel">
              <Icon className="landing-use-case-icon" aria-hidden />
                    {rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="trust" className="landing-section landing-trust scroll-mt-24">
          <div className="public-container landing-trust-grid">
            <Reveal>
              <SectionIntro index="04" eyebrow="Kontrollschicht" title="Vertrauen entsteht durch Nachvollziehbarkeit." text="Nicht durch ein Siegel im Footer, sondern durch klare Grenzen, dokumentierte Aktionen und überprüfbare Zustände im täglichen Betrieb." />
            </Reveal>
            <div className="landing-trust-list">
              {TRUST.map(({ title, text, Icon }, index) => (
                <Reveal key={title} delay={index * 60} className="landing-trust-item">
                  <Icon className="size-5" aria-hidden="true" />
                  <div><h3>{title}</h3><p>{text}</p></div>
                  <span>CHECK {String(index + 1).padStart(2, "0")}</span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-section landing-pricing scroll-mt-24">
          <div className="public-container">
            <Reveal>
              <SectionIntro index="05" eyebrow="Tarife" title="Mit dem Warenfluss wachsen. Nicht mit Komplexität starten." text="Drei klare Stufen. Der Einstieg bleibt kostenlos; weiterführende Kontrollen kommen dann dazu, wenn das Team sie wirklich braucht." inverted />
            </Reveal>
            <div className="landing-pricing-grid">
              {TIERS.map((tier, index) => (
                <Reveal key={tier.id} delay={index * 70} className={`landing-price-sheet ${tier.highlight ? "is-highlighted" : ""}`}>
                  <div className="landing-price-head"><span>PLAN / {tier.id}</span>{tier.highlight && <strong>EMPFOHLEN</strong>}</div>
                  <h3>{tier.name}</h3>
                  <p>{tier.tagline}</p>
                  <div className="landing-price"><strong>{tier.monthlyCents === 0 ? "0 €" : formatEuro(tier.monthlyCents)}</strong><span>{tier.monthlyCents === 0 ? "dauerhaft" : "/ Monat"}</span></div>
                  <ul>{tier.features.slice(0, 4).map((feature) => <li key={feature}><Check className="size-4" aria-hidden="true" />{feature}</li>)}</ul>
                  <Button asChild variant={tier.highlight ? "default" : "outline"} className="mt-auto w-full rounded-md">
                    <Link href="/registrieren">{tier.id === "FREE" ? "Kostenlos starten" : `${tier.name} prüfen`}<ArrowRight className="ml-1 size-4" aria-hidden="true" /></Link>
                  </Button>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-8 text-center"><Link href="/pricing" className="landing-text-link">Alle Tarifdetails und Feature-Grenzen ansehen <ArrowRight className="size-4" aria-hidden="true" /></Link></Reveal>
          </div>
        </section>

        <section id="about" className="landing-section landing-about scroll-mt-24">
          <div className="public-container landing-about-grid">
            <Reveal className="landing-about-copy">
              <p className="landing-kicker">06 / Warum StoargeX</p>
              <h2>Gebaut für Handel zwischen Tabellenchaos und Enterprise-ERP.</h2>
              <p>StoargeX richtet sich an Teams, deren Geschäft längst zusammenhängend arbeitet, deren Werkzeuge diese Beziehungen aber noch nicht abbilden. Die Leitidee ist deshalb bewusst operativ: Jede Bewegung soll lesbar bleiben – auch wenn Ware zurückkommt, den Eigentümer wechselt oder erst später ausgezahlt wird.</p>
              <Button asChild variant="outline" className="mt-7 rounded-md"><Link href="/about">Mehr über den Ansatz <ArrowRight className="ml-1 size-4" aria-hidden="true" /></Link></Button>
            </Reveal>
            <Reveal delay={100} className="landing-manifest">
              <div className="landing-manifest-head"><Barcode className="size-5" aria-hidden="true" /><span>TRANSIT LEDGER / MANIFEST</span></div>
              {["Beziehungen vor Einzelwerten", "Bewegungen vor Überschreibungen", "Kontrolle vor Automations-Show", "Operative Sprache vor SaaS-Slogans"].map((line, index) => <div key={line}><span>{String(index + 1).padStart(2, "0")}</span><strong>{line}</strong></div>)}
              <div className="landing-manifest-sign"><PackageCheck className="size-5" aria-hidden="true" />StoargeX Produktprinzip</div>
            </Reveal>
          </div>
        </section>

        <section id="question" className="landing-section landing-question scroll-mt-24">
          <div className="public-container landing-question-grid">
            <Reveal>
              <p className="landing-kicker">07 / Fragebereich</p>
              <h2>Handel hat Sonderfälle. Genau dort beginnt ein gutes System.</h2>
              <p>Kein schwebendes Fremdwidget: Ordnet einen realen Sonderfall dem passenden Prozesskontext zu und bereitet die Frage als nachvollziehbaren Kontrollpunkt vor.</p>
            </Reveal>
            <Reveal delay={100}><QuestionConsole /></Reveal>
          </div>
        </section>

        <section id="faq" className="landing-section landing-faq scroll-mt-24">
          <div className="public-container landing-faq-grid">
            <Reveal>
              <SectionIntro index="08" eyebrow="Kurz geklärt" title="Fragen, bevor die erste Ware eingebucht wird." text="Die wichtigsten Entscheidungen zum Einstieg – knapp genug für einen Überblick, konkret genug für den nächsten Schritt." />
            </Reveal>
            <div className="landing-faq-list">
              {FAQS.map(([question, answer], index) => (
                <Reveal key={question} delay={index * 45}>
                  <details><summary><span>{String(index + 1).padStart(2, "0")}</span>{question}<ArrowDownRight className="size-5" aria-hidden="true" /></summary><p>{answer}</p></details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-final-cta">
          <div className="public-container">
            <Reveal className="landing-final-inner">
              <div className="landing-final-mark"><CircleDollarSign className="size-6" aria-hidden="true" /><ReceiptText className="size-6" aria-hidden="true" /><Boxes className="size-6" aria-hidden="true" /></div>
              <p className="landing-kicker text-cargo-amber">Nächster Kontrollpunkt</p>
              <h2>Gebt eurer Ware eine lesbare Geschichte.</h2>
              <p>Organisation anlegen, ersten Wareneingang erfassen und den Warenfluss nicht mehr in Tabellen nachbauen.</p>
              <div><Button asChild size="lg" className="rounded-md px-7"><Link href="/registrieren">Kostenlos starten <ArrowRight className="ml-1 size-4" aria-hidden="true" /></Link></Button><Button asChild size="lg" variant="ghost" className="text-fog hover:bg-fog/10 hover:text-fog"><Link href="/login">Bereits dabei? Anmelden</Link></Button></div>
            </Reveal>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
