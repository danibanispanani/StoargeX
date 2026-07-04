import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/roles";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
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

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              StoargeX
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
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
      <main className="mx-auto max-w-5xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
