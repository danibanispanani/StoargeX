"use client";

import { useActionState, useState } from "react";
import { Check, PackageCheck } from "lucide-react";
import {
  createConsignmentAddonCheckoutAction,
  startConsignmentTrialAction,
} from "@/lib/actions/billing";
import type { ActionState } from "@/lib/actions/team";
import { CONSIGNMENT_ADDON } from "@/lib/billing";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ConsignmentAddonPricing({ trialDays }: { trialDays: number }) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [checkoutState, checkoutAction, checkoutPending] = useActionState<
    ActionState,
    FormData
  >(createConsignmentAddonCheckoutAction, null);
  const [trialState, trialAction, trialPending] = useActionState<
    ActionState,
    FormData
  >(startConsignmentTrialAction, null);

  return (
    <section
      id="konsignation-addon"
      className="mt-8 border-y border-transit-teal/30 bg-transit-teal/5 px-5 py-6"
    >
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <PackageCheck
              className="size-5 text-transit-teal"
              aria-hidden="true"
            />
            <h2 className="font-display text-xl font-semibold">
              {CONSIGNMENT_ADDON.name}-Add-on
            </h2>
            <Badge variant="outline">
              Im Business-Tarif bereits enthalten
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Zu Free oder Pro separat aktivierbar. Die Testphase bietet den
            vollstaendigen Funktionsumfang; nach Ablauf bleiben alle Daten
            erhalten und Schreibzugriffe werden gesperrt.
          </p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {CONSIGNMENT_ADDON.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-transit-teal"
                  aria-hidden="true"
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-64 space-y-3 md:border-l md:pl-6">
          <p className="text-sm font-medium">
            {CONSIGNMENT_ADDON.priceLabel}
          </p>
          <div className="flex gap-1 border p-1">
            <Button
              type="button"
              size="sm"
              variant={interval === "monthly" ? "secondary" : "ghost"}
              onClick={() => setInterval("monthly")}
            >
              Monatlich
            </Button>
            <Button
              type="button"
              size="sm"
              variant={interval === "yearly" ? "secondary" : "ghost"}
              onClick={() => setInterval("yearly")}
            >
              Jaehrlich
            </Button>
          </div>
          <form action={checkoutAction}>
            <input type="hidden" name="interval" value={interval} />
            <Button className="w-full" disabled={checkoutPending}>
              {checkoutPending ? "Weiterleitung..." : "Add-on aktivieren"}
            </Button>
          </form>
          <form action={trialAction}>
            <Button
              className="w-full"
              variant="outline"
              disabled={trialPending}
            >
              {trialPending
                ? "Wird aktiviert..."
                : `${trialDays} Tage kostenlos testen`}
            </Button>
          </form>
        </div>
      </div>

      {checkoutState?.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{checkoutState.error}</AlertDescription>
        </Alert>
      ) : null}
      {trialState?.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{trialState.error}</AlertDescription>
        </Alert>
      ) : null}
      {trialState?.success ? (
        <Alert className="mt-4 border-transit-teal/40">
          <AlertDescription>{trialState.success}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
