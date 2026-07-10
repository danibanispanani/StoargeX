import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Boxes,
  Percent,
  RotateCcw,
  Tags,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RouteLine } from "@/components/marketing/route-line";
import { Reveal } from "@/components/marketing/reveal";
import { CountUp } from "@/components/marketing/count-up";
import {
  MarketingFooter,
  MarketingNav,
} from "@/components/marketing/marketing-shell";

const FEATURES = [
  {
    Icon: Boxes,
    title: "Lager",
    text: "Wareneingang mit EK brutto/netto, EAN, Bildern und Plattform-Listings – durchsuchbar statt Tabellenblatt-Chaos.",
  },
  {
    Icon: Tags,
    title: "Verkauf",
    text: "Verkäufe je Plattform erfassen, Bestand reduziert sich automatisch, lesbare Order-IDs inklusive.",
  },
  {
    Icon: Percent,
    title: "Steuer-Automatik",
    text: "VK netto, Marge und Gewinn werden server-seitig berechnet – USt-Satz je Käuferland, §25a-Differenzbesteuerung inklusive.",
  },
  {
    Icon: RotateCcw,
    title: "Retouren",
    text: "Retouren am Verkauf verknüpft, tatsächlicher Verlust automatisch berechnet, Wiedereinlagern per Klick.",
  },
  {
    Icon: Users,
    title: "Team",
    text: "Rollen, Einladungen, Pflicht-2FA für Admins und ein Audit-Log, das jede sensible Aktion festhält.",
  },
];

const STATS = [
  { value: 4, suffix: " Stationen", label: "vom Einkauf bis zur Auszahlung" },
  { value: 3, suffix: " Plattformen", label: "eBay, Vinted & Kleinanzeigen ab Werk" },
  { value: 100, suffix: " %", label: "Mandantentrennung per Row Level Security" },
];

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="public-shell flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero mit Routenlinie */}
        <section id="workflow" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-16 pb-12 text-center sm:pt-24">
          <Reveal>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Kaufen. Verkaufen.{" "}
              <span className="text-transit-teal">Alles im Griff.</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              StoargeX ist die Warenwirtschaft für Handels-GbRs: Ware über
              eBay, Vinted und Kleinanzeigen kaufen und verkaufen – während
              Steuer, Marge, Retouren und Team automatisch mitlaufen.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild size="lg" className="hover-lift">
                <Link href="/registrieren">Organisation gründen</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="hover-lift">
                <Link href="/pricing">Preise ansehen</Link>
              </Button>
            </div>
          </Reveal>
          <div className="mt-12 flex justify-center">
            <RouteLine />
          </div>
        </section>

        {/* Zahlen */}
        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-center sm:grid-cols-3">
            {STATS.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 120}>
                <div>
                  <div className="text-4xl font-bold text-transit-teal">
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Feature-Sektionen */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-bold">
              Fünf Module. Ein Warenfluss.
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
              Alles, was bisher in Excel-Tabs, SUMIFS und Zetteln steckte –
              an einem Ort, mandantensicher und nachvollziehbar.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 90}>
                <Card className="hover-lift h-full">
                  <CardContent className="space-y-2 pt-2">
                    <feature.Icon className="size-6 text-transit-teal" />
                    <h3 className="font-display text-lg font-semibold">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{feature.text}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Social Proof (Platzhalter) */}
        <section className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <Reveal>
              <h2 className="text-center font-display text-3xl font-bold">
                Von Wiederverkäufern für Wiederverkäufer
              </h2>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                {
                  quote:
                    "Endlich sehe ich pro Verkauf sofort die echte Marge – inklusive Gebühren und Retouren-Verlusten.",
                  name: "Beispiel-Zitat · Sneaker-Reseller",
                },
                {
                  quote:
                    "Die Excel-Tabelle mit 14 Tabs ist Geschichte. Mein Mitgesellschafter und ich arbeiten jetzt im selben Stand.",
                  name: "Beispiel-Zitat · Handels-GbR",
                },
              ].map((testimonial, index) => (
                <Reveal key={testimonial.name} delay={index * 120}>
                  <Card className="hover-lift h-full">
                    <CardContent className="pt-2">
                      <p className="text-sm">&bdquo;{testimonial.quote}&ldquo;</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {testimonial.name}
                      </p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 text-center">
          <Reveal>
            <h2 className="font-display text-3xl font-bold">
              Preise und Einstieg
            </h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Kostenlos starten, Organisation gründen, Team einladen. Den
              vollständigen Planvergleich findest du auf der Pricing-Seite.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="hover-lift">
                <Link href="/registrieren">Jetzt kostenlos registrieren</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="hover-lift">
                <Link href="/pricing">Planvergleich öffnen</Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
