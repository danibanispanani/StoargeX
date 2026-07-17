import { CalendarClock, CircleAlert, TimerReset } from "lucide-react";
import type { FeatureEntitlementSnapshot } from "@/lib/services/feature-entitlement-service";

export function AddonTrialBanner({
  featureName,
  access,
}: {
  featureName: string;
  access: FeatureEntitlementSnapshot;
}) {
  const isTrial =
    access.source === "TRIAL" && access.trialDaysRemaining !== null;
  const isGrace =
    access.status === "GRACE_PERIOD" && access.graceDaysRemaining !== null;
  const isCancelled = access.status === "CANCELLED" && access.validUntil;
  if (!isTrial && !isGrace && !isCancelled) return null;

  const days = isGrace
    ? access.graceDaysRemaining
    : access.trialDaysRemaining;
  const Icon = isGrace ? CircleAlert : isCancelled ? CalendarClock : TimerReset;
  return (
    <div
      className="flex min-h-9 items-center gap-2 border-b border-transit-teal/30 bg-transit-teal/8 px-3 text-xs text-foreground sm:px-4"
      role="status"
    >
      <Icon className="size-4 shrink-0 text-transit-teal" aria-hidden="true" />
      {isCancelled ? (
        <span>
          <strong>{featureName}-Add-on gekündigt:</strong> voller Zugriff bis{" "}
          {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
            new Date(access.validUntil!)
          )}
          .
        </span>
      ) : (
        <span>
          <strong>
            {featureName}-{isGrace ? "Grace Period" : "Testphase"}:
          </strong>{" "}
          noch {days} {days === 1 ? "Tag" : "Tage"} verfügbar.
        </span>
      )}
    </div>
  );
}
