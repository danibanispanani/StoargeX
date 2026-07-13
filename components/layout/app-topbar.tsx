import type { SessionMembership } from "@/types/next-auth";
import type { FeatureAccessMap } from "@/components/layout/app-navigation-list";
import { ROLE_LABELS } from "@/lib/roles";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MobileAppNavigation } from "@/components/layout/mobile-app-navigation";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { UserMenu } from "@/components/layout/user-menu";

export function AppTopbar({
  memberships,
  activeOrganizationId,
  activeRole,
  user,
  featureAccess,
}: {
  memberships: readonly SessionMembership[];
  activeOrganizationId: string;
  activeRole: SessionMembership["role"];
  user: { name?: string | null; email?: string | null; image?: string | null };
  featureAccess: FeatureAccessMap;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex h-[3.25rem] items-center justify-between gap-2 px-2 sm:px-3 lg:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <MobileAppNavigation featureAccess={featureAccess} />
          <OrganizationSwitcher memberships={memberships} activeOrganizationId={activeOrganizationId} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden border-r pr-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:block">
            {ROLE_LABELS[activeRole]}
          </span>
          <ThemeToggle persist />
          <UserMenu user={user} roleLabel={ROLE_LABELS[activeRole]} />
        </div>
      </div>
    </header>
  );
}
