"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const MOBILE_LINKS = [
  { href: "/#workflow", label: "Workflow", code: "01" },
  { href: "/#features", label: "Anwendungsfälle", code: "02" },
  { href: "/#pricing", label: "Preise", code: "03" },
  { href: "/#about", label: "About", code: "04" },
  { href: "/#question", label: "Frage stellen", code: "05" },
  { href: "/#faq", label: "FAQ", code: "06" },
] as const;

export function MobilePublicNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Öffentliche Navigation öffnen"
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent className="public-mobile-sheet w-[min(92vw,25rem)] border-rail/20 p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-rail/15 px-6 py-6 text-left">
          <div className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-transit-teal">
            <Route className="size-4" aria-hidden="true" />
            Transit Ledger / Navigation
          </div>
          <SheetTitle className="mt-4 font-display text-3xl tracking-tight">
            Zum nächsten Kontrollpunkt.
          </SheetTitle>
          <SheetDescription className="leading-6">
            Springe direkt in den Warenfluss oder wechsle zum persönlichen Zugang.
          </SheetDescription>
        </SheetHeader>

        <nav className="public-mobile-nav" aria-label="Mobile Seitennavigation">
          {MOBILE_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              <span>{link.code}</span>
              <strong>{link.label}</strong>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-rail/15 p-6">
          <Button asChild className="w-full rounded-md">
            <Link href="/registrieren" onClick={() => setOpen(false)}>
              Organisation gründen
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <div className="mt-4 flex justify-between text-xs text-muted-foreground">
            <Link href="/login" onClick={() => setOpen(false)}>Anmelden</Link>
            <Link href="/datenschutz" onClick={() => setOpen(false)}>Datenschutz</Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
