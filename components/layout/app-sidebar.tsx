"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  HandCoins,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Menu,
  Package,
  RotateCcw,
  Settings,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/lager", label: "Lager", Icon: Boxes },
  { href: "/produkte", label: "Produkte", Icon: Package },
  { href: "/verkauf", label: "Verkauf", Icon: Tags },
  { href: "/retouren", label: "Retouren", Icon: RotateCcw },
  { href: "/konsignation", label: "Konsignation", Icon: Handshake },
  { href: "/schulden", label: "Schulden", Icon: HandCoins },
  { href: "/aufgaben", label: "Aufgaben", Icon: CheckSquare },
  { href: "/versand", label: "Versand", Icon: Truck },
  { href: "/zugangsdaten", label: "Zugangsdaten", Icon: KeyRound },
  { href: "/einstellungen", label: "Einstellungen", Icon: Settings },
  { href: "/team", label: "Team", Icon: Users },
];

const STORAGE_KEY = "sx-sidebar-collapsed";

function NavLinks({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            <item.Icon className="size-4 shrink-0" />
            {!collapsed && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop: einklappbare Sidebar. */
export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem(STORAGE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col gap-4 border-r bg-card py-4 md:flex",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div className={cn("flex items-center px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" className="font-display text-lg font-bold">
          {collapsed ? "SX" : "StoargeX"}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavLinks collapsed={collapsed} />
      </div>
      <div className="px-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className="w-full justify-center"
          aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" /> Einklappen
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

/** Mobile: Burger-Button (im Header) mit Overlay-Drawer. */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Navigation öffnen"
      >
        <Menu className="size-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-label="Navigation schließen"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col gap-4 border-r bg-background py-4 shadow-xl">
            <div className="flex items-center justify-between px-4">
              <span className="font-display text-lg font-bold">StoargeX</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                aria-label="Navigation schließen"
              >
                <X className="size-4" />
              </Button>
            </div>
            <NavLinks collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
