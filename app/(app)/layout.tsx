import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/org";
import { ThemeSync } from "@/components/theme/theme-sync";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AddonTrialBanner } from "@/components/app/addon-trial-banner";
import {
  FEATURE_KEYS,
  toFeatureEntitlementSnapshot,
} from "@/lib/services/feature-entitlement-service";
import { getFeatureAccess } from "@/lib/feature-access";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const activeMembership = session.memberships.find(
    (membership) => membership.orgId === session.activeOrgId
  );
  if (!activeMembership) redirect("/registrieren?schritt=organisation");

  const orgContext = await requireOrg();
  const { organization, membership } = orgContext;
  const now = new Date();
  const [dbUser, consignmentDecision] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { theme: true },
    }).catch((error) => {
      console.error("App-Shell: Theme konnte nicht geladen werden.", error);
      return null;
    }),
    getFeatureAccess(orgContext, FEATURE_KEYS.CONSIGNMENT).catch((error) => {
      console.error("App-Shell: Entitlement konnte nicht geladen werden.", error);
      return { enabled: false, source: null, grantId: null, validUntil: null } as const;
    }),
  ]);
  const consignmentAccess = toFeatureEntitlementSnapshot(consignmentDecision, now);
  const featureAccess = { [FEATURE_KEYS.CONSIGNMENT]: consignmentAccess };

  return (
    <div className="flex min-h-screen bg-background">
      <ThemeSync dbTheme={dbUser?.theme ?? null} />
      <AppSidebar featureAccess={featureAccess} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          memberships={session.memberships}
          activeOrganizationId={organization.id}
          activeRole={membership.role}
          user={session.user}
          featureAccess={featureAccess}
        />
        <AddonTrialBanner featureName="Konsignation" access={consignmentAccess} />
        <main className="min-w-0 flex-1 px-3 py-3 sm:px-4 lg:px-5">
          <div className="mb-3 hidden sm:block">
            <Breadcrumbs />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
