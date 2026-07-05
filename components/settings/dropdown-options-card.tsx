"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  addPlatformAction,
  addSelectOptionAction,
  removeSelectOptionAction,
  togglePlatformAction,
} from "@/lib/actions/catalog-settings";
import type { ActionState } from "@/lib/actions/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PlatformsCard({
  platforms,
  readOnly,
}: {
  platforms: Array<{ id: string; name: string; active: boolean }>;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addPlatformAction,
    null
  );
  const [toggling, startToggle] = useTransition();

  useEffect(() => {
    if (state?.success) toast.success(state.success);
  }, [state]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {platforms.map((platform) => (
          <Badge
            key={platform.id}
            variant={platform.active ? "secondary" : "outline"}
            className={platform.active ? "" : "opacity-50"}
          >
            {platform.name}
            {!readOnly && (
              <button
                type="button"
                disabled={toggling}
                title={platform.active ? "Deaktivieren" : "Aktivieren"}
                onClick={() =>
                  startToggle(async () => {
                    const result = await togglePlatformAction(
                      platform.id,
                      !platform.active
                    );
                    if (result?.error) toast.error(result.error);
                    else if (result?.success) toast.success(result.success);
                  })
                }
                className="ml-1.5 text-muted-foreground hover:text-foreground"
              >
                {platform.active ? "×" : "+"}
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!readOnly && (
        <form action={formAction} className="flex max-w-sm gap-2">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Input name="name" placeholder="z.B. eBay Account 3" required />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "…" : "Hinzufügen"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function OptionListCard({
  kind,
  options,
  readOnly,
  placeholder,
}: {
  kind: "PAYMENT_METHOD" | "PAYOUT_RECIPIENT";
  options: Array<{ id: string; label: string }>;
  readOnly: boolean;
  placeholder: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addSelectOptionAction,
    null
  );
  const [removing, startRemove] = useTransition();

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Badge key={option.id} variant="secondary">
            {option.label}
            {!readOnly && (
              <button
                type="button"
                disabled={removing}
                title="Entfernen"
                onClick={() =>
                  startRemove(async () => {
                    const result = await removeSelectOptionAction(option.id);
                    if (result?.error) toast.error(result.error);
                    else if (result?.success) toast.success(result.success);
                  })
                }
                className="ml-1.5 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            )}
          </Badge>
        ))}
        {options.length === 0 && (
          <span className="text-sm text-muted-foreground">Keine Werte.</span>
        )}
      </div>
      {!readOnly && (
        <form action={formAction} className="flex max-w-sm gap-2">
          <input type="hidden" name="kind" value={kind} />
          <Input name="label" placeholder={placeholder} required />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "…" : "Hinzufügen"}
          </Button>
        </form>
      )}
    </div>
  );
}
