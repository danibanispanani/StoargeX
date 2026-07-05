"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { createPortalAction } from "@/lib/actions/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const [pending, startTransition] = useTransition();

  function openPortal() {
    startTransition(async () => {
      const result = await createPortalAction();
      if (result?.error) toast.error(result.error);
    });
  }

  return (
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
              {pending ? "Öffnet…" : "Abo verwalten (Stripe)"}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nur Inhaber können den Plan ändern.
        </p>
      )}
    </div>
  );
}
