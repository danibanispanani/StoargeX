import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Fingerprint,
  KeyRound,
  LogIn,
  PackageCheck,
  Route,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MobilePublicNav } from "@/components/marketing/mobile-public-nav";

const NAV_LINKS = [
  { href: "/#workflow", label: "Workflow" },
  { href: "/#features", label: "Funktionen" },
  { href: "/#pricing", label: "Preise" },
  { href: "/#about", label: "About" },
  { href: "/#question", label: "Frage" },
  { href: "/#faq", label: "FAQ" },
];

const FOOTER_GROUPS = [
  {
    title: "Produkt",
    links: [
      { href: "/#workflow", label: "Workflow" },
      { href: "/#features", label: "Funktionen" },
      { href: "/#pricing", label: "Preise" },
      { href: "/login", label: "Anmelden" },
      { href: "/registrieren", label: "Organisation gründen" },
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
        <span className="public-metadata hidden text-[0.64rem] sm:block">
          Transit Ledger
        </span>
      </span>
    </Link>
  );
}

export function MarketingNav() {
  return (
    <header className="public-nav sticky top-0 z-40 border-b border-rail/15 bg-paper/88 backdrop-blur-md dark:bg-background/88">
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
          <MobilePublicNav />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login" aria-label="Anmelden">
              <LogIn className="size-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Anmelden</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="hover-lift rounded-md">
            <Link href="/registrieren">
              <span className="sm:hidden">Starten</span>
              <span className="hidden sm:inline">Organisation gründen</span>
              <ArrowRight className="ml-1 hidden size-4 sm:block" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="public-footer border-t border-rail/15 bg-card/70">
      <div className="public-footer-route" aria-hidden="true">
        {["Einkauf", "Bestand", "Verkauf", "Retoure", "Auszahlung"].map((item, index) => (
          <span key={item}><i>{String(index + 1).padStart(2, "0")}</i>{item}</span>
        ))}
      </div>
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
    <section className="public-page-header public-container py-12 sm:py-18">
      <div className="public-page-header-grid">
        <div className="max-w-3xl">
          <Link href="/" className="public-back-link public-focus-link">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Zur Landingpage
          </Link>
          <p className="public-section-kicker mt-7">{eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="public-page-gate" aria-hidden="true">
          <span>PUBLIC / TRANSIT</span>
          <div><i /><i /><i className="is-active" /><i /><i /></div>
          <strong>Information checkpoint</strong>
        </div>
      </div>
    </section>
  );
}

export function PublicAuthShell({
  children,
  mode,
  title,
  description,
  switchHref,
  switchLabel,
}: {
  children: ReactNode;
  mode: "login" | "register";
  title: string;
  description: string;
  switchHref: string;
  switchLabel: string;
}) {
  const isLogin = mode === "login";
  const gateCode = isLogin ? "GATE / RETURN" : "GATE / ORIGIN";
  const activeStation = isLogin ? "Zugang" : "Organisation";

  return (
    <main className="public-shell auth-redesign min-h-screen">
      <div className="auth-shell mx-auto flex min-h-screen w-full max-w-[100rem] flex-col px-4 py-4 sm:px-6 sm:py-6">
        <div className="auth-topbar flex items-center justify-between gap-4">
          <PublicBrand />
          <Button asChild variant="ghost" size="sm" className="auth-home-link">
            <Link href="/">
              <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
              Zur Landingpage
            </Link>
          </Button>
        </div>

        <div className="auth-stage grid flex-1 py-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)] lg:py-8">
          <aside className="auth-scene relative overflow-hidden" aria-label="StoargeX Produktkontext">
            <div className="auth-scene-grid" aria-hidden="true" />
            <div className="auth-scene-content relative z-10 flex h-full flex-col p-6 sm:p-9 lg:p-12">
              <div className="flex items-center justify-between gap-4">
                <p className="auth-scene-kicker">Transit Gate</p>
                <span className="auth-gate-code">{gateCode}</span>
              </div>

              <div className="auth-scene-copy">
                <span className="auth-scan-mark" aria-hidden="true">
                  <ScanLine className="size-5" />
                </span>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>

              <div className="auth-route-board" aria-label={`Aktueller Schritt: ${activeStation}`}>
                <div className="auth-route-line" aria-hidden="true" />
                {["Einkauf", "Bestand", "Verkauf", "Retoure", "Auszahlung"].map(
                  (station, index) => (
                    <div className="auth-route-stop" key={station}>
                      <span className={index === 1 ? "is-live" : ""}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <small>{station}</small>
                    </div>
                  )
                )}
              </div>

              <div className="auth-scene-footer mt-auto">
                <div className="auth-checkpoint">
                  <span className="auth-checkpoint-icon" aria-hidden="true">
                    {isLogin ? <Fingerprint className="size-5" /> : <KeyRound className="size-5" />}
                  </span>
                  <span>
                    <small>Aktueller Kontrollpunkt</small>
                    <strong>{activeStation}</strong>
                  </span>
                </div>
                <div className="auth-trust-strip" aria-label="Sicherheitsmerkmale">
                  <span><ShieldCheck aria-hidden="true" /> 2FA bereit</span>
                  <span><Route aria-hidden="true" /> Auditierbar</span>
                  <span><PackageCheck aria-hidden="true" /> Mandantentrennung</span>
                </div>
              </div>
            </div>
          </aside>

          <section className="auth-manifest flex min-w-0 flex-col" aria-label={isLogin ? "Login" : "Registrierung"}>
            <div className="auth-manifest-meta">
              <span>StoargeX / {isLogin ? "Login" : "Setup"}</span>
              <span>Gesicherter Zugang</span>
            </div>
            <div className="auth-manifest-body flex-1">{children}</div>
            <div className="auth-manifest-footer">
              <Link href={switchHref} className="auth-switch-link public-focus-link">
                {switchLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <div className="flex flex-wrap gap-3">
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
    <div className="public-track-card public-placeholder flex gap-3 border-cargo-amber/35 bg-cargo-amber/10 p-4 text-sm">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cargo-amber" aria-hidden="true" />
      <p className="leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
