"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { createCheckoutAction } from "@/lib/actions/billing";
import type { ActionState } from "@/lib/actions/team";
import type { TierInfo } from "@/lib/billing";
import { formatEuro } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PricingTiers({ tiers }: { tiers: TierInfo[] }) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCheckoutAction,
    null
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="flex rounded-md border p-0.5">
          <Button
            variant={interval === "monthly" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setInterval("monthly")}
          >
            Monatlich
          </Button>
          <Button
            variant={interval === "yearly" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setInterval("yearly")}
          >
            Jährlich <span className="ml-1 text-xs text-transit-teal">2 Monate geschenkt</span>
          </Button>
        </div>
      </div>

      {state?.error && (
        <Alert variant="destructive" className="mx-auto max-w-xl">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => {
          const cents = interval === "monthly" ? tier.monthlyCents : tier.yearlyCents;
          return (
            <Card
              key={tier.id}
              className={cn(
                "hover-lift relative h-full",
                tier.highlight && "border-transit-teal shadow-lg"
              )}
            >
              {tier.highlight && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-transit-teal text-white">
                  Beliebt
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="font-display">{tier.name}</CardTitle>
                <CardDescription>{tier.tagline}</CardDescription>
                <div className="pt-2">
                  <span className="font-display text-4xl font-bold tabular-nums">
                    {cents === 0 ? "0 €" : formatEuro(cents)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {cents === 0
                      ? " für immer"
                      : interval === "monthly"
                        ? " / Monat"
                        : " / Jahr"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex h-full flex-col gap-4">
                <ul className="space-y-2 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-transit-teal" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {tier.id === "FREE" ? (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/registrieren">Kostenlos starten</Link>
                    </Button>
                  ) : (
                    <form action={formAction}>
                      <input type="hidden" name="tier" value={tier.id} />
                      <input type="hidden" name="interval" value={interval} />
                      <Button
                        type="submit"
                        className="w-full"
                        variant={tier.highlight ? "default" : "outline"}
                        disabled={pending}
                      >
                        {pending ? "Weiterleitung…" : `${tier.name} wählen`}
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
