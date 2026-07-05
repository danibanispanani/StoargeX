import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ThemeSync } from "@/components/theme/theme-sync";
import { ROLE_LABELS } from "@/lib/roles";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/berichte", label: "Berichte" },
  { href: "/lager", label: "Lager" },
  { href: "/verkauf", label: "Verkauf" },
  { href: "/versand", label: "Versand" },
  { href: "/retouren", label: "Retouren" },
  { href: "/konsignation", label: "Konsignation" },
  { href: "/schulden", label: "Schulden" },
  { href: "/aufgaben", label: "Aufgaben" },
  { href: "/zugangsdaten", label: "Zugangsdaten" },
  { href: "/team", label: "Team" },
  { href: "/einstellungen", label: "Einstellungen" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const activeMembership = session.memberships.find(
    (m) => m.orgId === session.activeOrgId
  );
  if (!activeMembership) redirect("/registrieren?schritt=organisation");

  // Dark-Mode-Präferenz aus der DB (überschreibt lokale Einstellung einmalig)
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { theme: true },
  });

  return (
    <div className="min-h-screen">
      <ThemeSync dbTheme={dbUser?.theme ?? null} />
      <header className="border-b">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/dashboard" className="font-semibold">
              StoargeX
            </Link>
            <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-medium">{activeMembership.orgName}</div>
              <div className="text-xs text-muted-foreground">
                {session.user.email}
              </div>
            </div>
            <Badge variant="secondary">
              {ROLE_LABELS[activeMembership.role]}
            </Badge>
            <ThemeToggle persist />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
