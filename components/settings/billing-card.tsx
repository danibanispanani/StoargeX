"use client";

import Link from "next/link";
import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPortalAction, redeemPlanCodeAction } from "@/lib/actions/billing";
import type { ActionState } from "@/lib/actions/team";
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
}: {
  tier: string;
  hasSubscription: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [codeState, codeAction, codePending] = useActionState<ActionState, FormData>(
    redeemPlanCodeAction,
    null
  );

  useEffect(() => {
    if (codeState?.error) toast.error(codeState.error);
    if (codeState?.success) {
      toast.success(codeState.success);
      router.refresh();
    }
  }, [codeState, router]);

  function openPortal() {
    startTransition(async () => {
      const result = await createPortalAction();
      if (result?.error) toast.error(result.error);
    });
  }

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
    </div>
  );
}
