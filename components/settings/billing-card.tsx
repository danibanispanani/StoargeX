"use client";

import Link from "next/link";
import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createPortalAction,
  redeemConsignmentAddonCodeAction,
  redeemPlanCodeAction,
  startConsignmentTrialAction,
} from "@/lib/actions/billing";
import type { ActionState } from "@/lib/actions/team";
import type { FeatureEntitlementSnapshot } from "@/lib/services/feature-entitlement-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TIER_LABELS: Record<string, string> = {
  FREE: "Free",
  PRO: "Pro",
  BUSINESS: "Business",
};

export function BillingCard({
  tier,
  hasSubscription,
  isOwner,
  consignmentAccess,
  consignmentTrialDays,
}: {
  tier: string;
  hasSubscription: boolean;
  isOwner: boolean;
  consignmentAccess: FeatureEntitlementSnapshot;
  consignmentTrialDays: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [codeState, codeAction, codePending] = useActionState<ActionState, FormData>(
    redeemPlanCodeAction,
    null
  );
  const [addonCodeState, addonCodeAction, addonCodePending] = useActionState<
    ActionState,
    FormData
  >(redeemConsignmentAddonCodeAction, null);
  const [trialState, trialAction, trialPending] = useActionState<
    ActionState,
    FormData
  >(startConsignmentTrialAction, null);

  useEffect(() => {
    if (codeState?.error) toast.error(codeState.error);
    if (codeState?.success) {
      toast.success(codeState.success);
      router.refresh();
    }
  }, [codeState, router]);

  useEffect(() => {
    if (addonCodeState?.error) toast.error(addonCodeState.error);
    if (addonCodeState?.success) {
      toast.success(addonCodeState.success);
      router.refresh();
    }
  }, [addonCodeState, router]);

  useEffect(() => {
    if (trialState?.error) toast.error(trialState.error);
    if (trialState?.success) {
      toast.success(trialState.success);
      router.refresh();
    }
  }, [trialState, router]);

  function openPortal() {
    startTransition(async () => {
      const result = await createPortalAction();
      if (result?.error) toast.error(result.error);
    });
  }

  const addonLabel =
    consignmentAccess.source === "LEGACY_TIER"
      ? "Im Business-Tarif enthalten"
      : consignmentAccess.source === "TRIAL"
        ? "Testphase aktiv"
        : consignmentAccess.status === "GRACE_PERIOD"
          ? "Grace Period"
          : consignmentAccess.status === "CANCELLED"
            ? "Zum Laufzeitende gekündigt"
            : consignmentAccess.enabled
              ? "Aktiv"
              : "Nicht aktiviert";
  const validUntil = consignmentAccess.validUntil
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
        new Date(consignmentAccess.validUntil)
      )
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Aktueller Plan:</span>
          <Badge variant={tier === "FREE" ? "secondary" : "default"}>
            {TIER_LABELS[tier] ?? tier}
          </Badge>
        </div>

        {isOwner ? (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/pricing">Plan wechseln</Link>
            </Button>
            {hasSubscription && (
              <Button onClick={openPortal} disabled={pending}>
                {pending ? "Oeffnet..." : "Abo verwalten (Stripe)"}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nur Inhaber koennen den Plan aendern.
          </p>
        )}
      </div>

      {isOwner && (
        <form action={codeAction} className="flex max-w-md flex-wrap items-center gap-2">
          <Input
            name="code"
            type="password"
            placeholder="Plan-Code eingeben"
            autoComplete="off"
            className="min-w-48 flex-1"
          />
          <Button type="submit" variant="secondary" disabled={codePending}>
            {codePending ? "Prueft..." : "Code einloesen"}
          </Button>
        </form>
      )}

      <div className="border-t pt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">Konsignations-Add-on</p>
              <Badge
                variant={consignmentAccess.enabled ? "default" : "secondary"}
              >
                {addonLabel}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Konsignationsdaten bleiben unabhängig vom Add-on-Status
              gespeichert. Ohne aktives Recht sind operative Mutationen
              serverseitig gesperrt.
            </p>
            {validUntil ? (
              <p className="mt-2 text-sm">
                {consignmentAccess.status === "CANCELLED"
                  ? `Nutzbar bis ${validUntil}.`
                  : consignmentAccess.status === "GRACE_PERIOD"
                    ? `Grace Period bis ${validUntil}.`
                    : consignmentAccess.source === "TRIAL"
                      ? `Testphase bis ${validUntil}.`
                      : `Aktueller Zeitraum bis ${validUntil}.`}
              </p>
            ) : null}
          </div>

          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              {!consignmentAccess.enabled ? (
                <form action={trialAction}>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={trialPending}
                  >
                    {trialPending
                      ? "Aktiviert..."
                      : `${consignmentTrialDays} Tage testen`}
                  </Button>
                </form>
              ) : null}
              <Button asChild>
                <Link href="/pricing?feature=Konsignation#konsignation-addon">
                  {consignmentAccess.enabled
                    ? "Add-on-Optionen"
                    : "Add-on ansehen"}
                </Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nur Inhaber können das Add-on ändern.
            </p>
          )}
        </div>

        {isOwner ? (
          <form
            action={addonCodeAction}
            className="mt-4 flex max-w-md flex-wrap items-center gap-2"
          >
            <Input
              name="code"
              type="password"
              placeholder="Interner Add-on-Code"
              autoComplete="off"
              className="min-w-48 flex-1"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={addonCodePending}
            >
              {addonCodePending ? "Prüft..." : "Manuell freischalten"}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
