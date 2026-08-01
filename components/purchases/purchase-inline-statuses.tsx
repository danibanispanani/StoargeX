"use client";

import { useTransition } from "react";
import type { PurchaseShippingStatus, PurchaseStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  updatePurchaseShippingStatusAction,
  updatePurchaseStatusAction,
} from "@/lib/actions/purchases";
import {
  DEFAULT_PURCHASE_STATUS,
  PURCHASE_SHIPPING_STATUS_LABELS,
  PURCHASE_SHIPPING_STATUS_VALUES,
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_VALUES,
} from "@/lib/purchases/purchase-workflow";
import { cn } from "@/lib/utils";

export function PurchaseStatusSelect({ purchaseId, status }: {
  purchaseId: string;
  status: PurchaseStatus;
}) {
  const [pending, startTransition] = useTransition();
  const value = status === "DRAFT" ? DEFAULT_PURCHASE_STATUS : status;

  if (status === "CANCELLED") return <StatusLabel label="Storniert" tone="danger" />;
  return <select
    value={value}
    disabled={pending}
    aria-label="Bestellstatus ändern"
    onChange={(event) => startTransition(async () => {
      const result = await updatePurchaseStatusAction(purchaseId, event.target.value);
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
    })}
    className="h-7 border-0 bg-muted px-1.5 text-xs font-medium"
  >
    {PURCHASE_STATUS_VALUES.map((item) => <option key={item} value={item}>{PURCHASE_STATUS_LABELS[item]}</option>)}
  </select>;
}

export function PurchaseShippingStatusSelect({ purchaseId, status, cancelled }: {
  purchaseId: string;
  status: PurchaseShippingStatus;
  cancelled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const value = status === "READY" ? "NOT_SHIPPED" : status;

  if (cancelled) return <StatusLabel label={PURCHASE_SHIPPING_STATUS_LABELS[value]} tone="muted" />;
  return <select
    value={value}
    disabled={pending}
    aria-label="Versandstatus ändern"
    onChange={(event) => startTransition(async () => {
      const result = await updatePurchaseShippingStatusAction(purchaseId, event.target.value);
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
    })}
    className="h-7 border-0 bg-muted px-1.5 text-xs font-medium"
  >
    {PURCHASE_SHIPPING_STATUS_VALUES.map((item) => <option key={item} value={item}>{PURCHASE_SHIPPING_STATUS_LABELS[item]}</option>)}
  </select>;
}

function StatusLabel({ label, tone }: { label: string; tone: "danger" | "muted" }) {
  return <span className={cn(
    "inline-flex h-7 items-center px-2 text-xs font-medium",
    tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
  )}>{label}</span>;
}
