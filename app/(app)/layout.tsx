import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ThemeSync } from "@/components/theme/theme-sync";
import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { ROLE_LABELS } from "@/lib/roles";

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
    <div className="flex min-h-screen">
      <ThemeSync dbTheme={dbUser?.theme ?? null} />
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
          <div className="flex h-12 items-center justify-between gap-2 px-3 sm:px-4">
            <div className="flex items-center gap-2">
              <MobileNav />
              <span className="truncate text-sm font-medium">
                {activeMembership.orgName}
              </span>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {ROLE_LABELS[activeMembership.role]}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden text-xs text-muted-foreground sm:block">
                {session.user.email}
              </span>
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
        <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
