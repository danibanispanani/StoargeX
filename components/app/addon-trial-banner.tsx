import { TimerReset } from "lucide-react";
import type { FeatureEntitlementSnapshot } from "@/lib/services/feature-entitlement-service";

export function AddonTrialBanner({
  featureName,
  access,
}: {
  featureName: string;
  access: FeatureEntitlementSnapshot;
}) {
  if (access.source !== "TRIAL" || access.trialDaysRemaining === null) return null;

  const days = access.trialDaysRemaining;
  return (
    <div className="flex min-h-9 items-center gap-2 border-b border-transit-teal/30 bg-transit-teal/8 px-3 text-xs text-foreground sm:px-4" role="status">
      <TimerReset className="size-4 shrink-0 text-transit-teal" aria-hidden="true" />
      <span>
        <strong>{featureName}-Testphase:</strong> noch {days} {days === 1 ? "Tag" : "Tage"} verfügbar.
      </span>
    </div>
  );
}
