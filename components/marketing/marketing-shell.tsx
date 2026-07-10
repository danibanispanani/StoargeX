import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  PackageCheck,
  Route,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const NAV_LINKS = [
  { href: "/#workflow", label: "Workflow" },
  { href: "/#features", label: "Funktionen" },
  { href: "/#pricing", label: "Preise" },
  { href: "/about", label: "About" },
];

const FOOTER_GROUPS = [
  {
    title: "Produkt",
    links: [
      { href: "/#workflow", label: "Workflow" },
      { href: "/#features", label: "Funktionen" },
      { href: "/#pricing", label: "Preise" },
      { href: "/login", label: "Anmelden" },
      { href: "/registrieren", label: "Registrieren" },
    ],
  },
  {
    title: "Vertrauen",
    links: [
      { href: "/about", label: "About" },
      { href: "/about#kontakt", label: "Kontakt" },
      { href: "/pricing", label: "Planvergleich" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { href: "/impressum", label: "Impressum" },
      { href: "/datenschutz", label: "Datenschutz" },
      { href: "/agb", label: "AGB" },
    ],
  },
];

function BrandMark() {
  return (
    <span className="flex size-9 items-center justify-center rounded-md border border-rail/20 bg-transit-teal text-primary-foreground shadow-sm">
      <PackageCheck className="size-5" aria-hidden="true" />
    </span>
  );
}

export function PublicBrand() {
  return (
    <Link
      href="/"
      className="group flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="StoargeX Startseite"
    >
      <BrandMark />
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold tracking-tight">
          StoargeX
        </span>
        <span className="public-metadata block text-[0.64rem]">
          Transit Ledger
        </span>
      </span>
    </Link>
  );
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-rail/15 bg-paper/88 backdrop-blur-md dark:bg-background/88">
      <div className="public-container flex min-h-16 items-center justify-between gap-4 py-2">
        <PublicBrand />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Öffentliche Navigation">
          {NAV_LINKS.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Anmelden</Link>
          </Button>
          <Button asChild size="sm" className="hover-lift rounded-md">
            <Link href="/registrieren">
              Organisation gründen
              <ArrowRight className="ml-1 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-rail/15 bg-card/70">
      <div className="public-container grid gap-10 py-12 md:grid-cols-[1.35fr_2fr]">
        <div className="space-y-4">
          <PublicBrand />
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            Operative Warenwirtschaft für Teams, die Einkauf, Bestand, Verkauf,
            Retoure und Auszahlung in einer nachvollziehbaren Spur führen.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {["Bewegungsbasiert", "Mandantenfähig", "Auditierbar"].map((item) => (
              <span
                key={item}
                className="rounded-md border border-rail/15 bg-paper px-2.5 py-1 font-mono text-muted-foreground dark:bg-secondary"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="public-section-kicker">{group.title}</h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="public-focus-link underline decoration-transparent">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-rail/10">
        <div className="public-container flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} StoargeX. Alle Rechte vorbehalten.</span>
          <span className="font-mono">Einkauf → Bestand → Verkauf → Retoure → Auszahlung</span>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="public-shell flex min-h-screen flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}

export function PublicPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="public-container py-14 sm:py-20">
      <div className="max-w-3xl">
        <p className="public-section-kicker">{eyebrow}</p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          {description}
        </p>
      </div>
    </section>
  );
}

export function PublicAuthShell({
  children,
  title,
  description,
  switchHref,
  switchLabel,
}: {
  children: ReactNode;
  title: string;
  description: string;
  switchHref: string;
  switchLabel: string;
}) {
  return (
    <main className="public-shell min-h-screen px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <div className="flex items-center justify-between gap-4">
          <PublicBrand />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
              Startseite
            </Link>
          </Button>
        </div>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[0.92fr_1fr]">
          <aside className="public-ledger-panel overflow-hidden p-6 sm:p-8">
            <p className="public-section-kicker">Zugang zur Leitstelle</p>
            <h1 className="mt-4 max-w-lg font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              {description}
            </p>
            <div className="mt-8 space-y-3">
              {[
                ["Einkauf", "Wareneingänge bleiben nachvollziehbar."],
                ["Bestand", "Bewegungen laufen über klare Buchungen."],
                ["Verkauf", "Marge und Auszahlung hängen an derselben Spur."],
              ].map(([label, text]) => (
                <div
                  key={label}
                  className="grid grid-cols-[auto_1fr] gap-3 rounded-md border border-rail/15 bg-card/70 p-3"
                >
                  <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-mint-signal text-transit-teal dark:bg-accent">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-mono text-xs font-semibold uppercase tracking-[0.14em] text-stamp">
                      {label}
                    </span>
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
              <Route className="size-4 text-transit-teal" aria-hidden="true" />
              <span>Vom Warenfluss direkt in euren Arbeitsstand.</span>
            </div>
          </aside>

          <section className="public-track-card mx-auto w-full max-w-md p-5 sm:p-6">
            {children}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-rail/10 pt-4 text-sm text-muted-foreground">
              <Link href={switchHref} className="public-focus-link underline decoration-transparent">
                {switchLabel}
              </Link>
              <div className="flex gap-3">
                <Link href="/datenschutz" className="public-focus-link underline decoration-transparent">
                  Datenschutz
                </Link>
                <Link href="/impressum" className="public-focus-link underline decoration-transparent">
                  Impressum
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function PlaceholderNotice({ children }: { children: ReactNode }) {
  return (
    <div className="public-track-card flex gap-3 border-cargo-amber/35 bg-cargo-amber/10 p-4 text-sm">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cargo-amber" aria-hidden="true" />
      <p className="leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
