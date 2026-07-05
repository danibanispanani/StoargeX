import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-display text-lg font-bold">
          StoargeX
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/pricing">Preise</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Anmelden</Link>
          </Button>
          <ThemeToggle />
          <Button asChild size="sm" className="hover-lift">
            <Link href="/registrieren">Kostenlos starten</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <span className="font-display font-semibold text-foreground">
          StoargeX
        </span>
        <span>Warenwirtschaft für Handels-GbRs</span>
        <nav className="flex gap-4">
          <Link href="/pricing" className="hover:text-foreground">
            Preise
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Anmelden
          </Link>
          <Link href="/registrieren" className="hover:text-foreground">
            Registrieren
          </Link>
        </nav>
      </div>
    </footer>
  );
}
