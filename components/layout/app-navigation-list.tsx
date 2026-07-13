"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FeatureEntitlementSnapshot,
  FeatureKey,
} from "@/lib/services/feature-entitlement-service";
import { APP_NAVIGATION, isNavigationItemActive } from "@/components/layout/app-navigation";

export type FeatureAccessMap = Readonly<
  Partial<Record<FeatureKey, FeatureEntitlementSnapshot>>
>;

export function AppNavigationList({
  collapsed = false,
  featureAccess,
  onNavigate,
}: {
  collapsed?: boolean;
  featureAccess: FeatureAccessMap;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Hauptnavigation" className="space-y-4 px-2">
      {APP_NAVIGATION.map((section) => (
        <div key={section.label}>
          <p
            className={cn(
              "mb-1 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/45",
              collapsed && "sr-only"
            )}
          >
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = isNavigationItemActive(pathname, item.href);
              const access = item.featureKey
                ? featureAccess[item.featureKey]
                : undefined;
              const locked = Boolean(item.featureKey && !access?.enabled);
              const trial = Boolean(
                item.featureKey &&
                  access?.source === "TRIAL" &&
                  access.trialDaysRemaining !== null
              );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.shortLabel ?? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-9 items-center gap-3 px-2 text-sm text-sidebar-foreground/72 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring",
                    "before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-transparent before:content-['']",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:bg-transit-teal",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <item.Icon className="size-4 shrink-0" aria-hidden="true" />
                  {!collapsed ? (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {locked ? (
                        <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-cargo-amber">
                          <LockKeyhole className="size-3" aria-hidden="true" /> Add-on
                        </span>
                      ) : null}
                      {trial ? (
                        <span className="font-mono text-[9px] uppercase tracking-wider text-transit-teal">
                          {access?.trialDaysRemaining}T
                        </span>
                      ) : null}
                    </>
                  ) : locked ? (
                    <LockKeyhole className="absolute right-1 bottom-1 size-2.5 text-cargo-amber" aria-hidden="true" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
