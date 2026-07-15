"use client";

import type { SupplierReturnStatus } from "@prisma/client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/actions/team";
import {
  dispatchSupplierReturnAction,
  recordSupplierReturnRefundAction,
  updateSupplierReturnStatusAction,
} from "@/lib/actions/supplier-returns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SupplierReturnActions({
  supplierReturnId,
  status,
}: {
  supplierReturnId: string;
  status: SupplierReturnStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [refund, setRefund] = useState("");
  const [creditReference, setCreditReference] = useState("");

  function run(action: () => Promise<ActionState>, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  return (
    <div className="min-w-64 space-y-2">
      <div className="flex flex-wrap gap-1">
        {status === "DRAFT" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateSupplierReturnStatusAction(supplierReturnId, "REQUESTED"))}>Anfragen</Button>}
        {status === "REQUESTED" && <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateSupplierReturnStatusAction(supplierReturnId, "APPROVED"))}>Genehmigen</Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => updateSupplierReturnStatusAction(supplierReturnId, "REJECTED", "Vom Lieferanten abgelehnt"), "Lieferantenretoure wirklich als abgelehnt markieren?")}>Ablehnen</Button>
        </>}
        {status === "APPROVED" && <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => updateSupplierReturnStatusAction(supplierReturnId, "REJECTED", "Vom Lieferanten abgelehnt"), "Lieferantenretoure wirklich als abgelehnt markieren?")}>Ablehnen</Button>}
        {status === "DISPATCHED" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateSupplierReturnStatusAction(supplierReturnId, "ARRIVED"))}>Angekommen</Button>}
        {status === "ARRIVED" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateSupplierReturnStatusAction(supplierReturnId, "REFUND_PENDING"))}>Erstattung offen</Button>}
        {["ARRIVED", "REFUNDED", "PARTIALLY_REFUNDED", "REPLACEMENT_PENDING"].includes(status) && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateSupplierReturnStatusAction(supplierReturnId, "COMPLETED"))}>Abschließen</Button>}
      </div>

      {status === "APPROVED" && <div className="grid gap-1 sm:grid-cols-2">
        <Input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Versanddienstleister" />
        <Input value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Trackingnummer" />
        <Button className="sm:col-span-2" size="sm" disabled={pending} onClick={() => run(() => dispatchSupplierReturnAction(supplierReturnId, carrier, tracking), "Versand buchen? Die ausgewählten Mengen werden aus dem Bestand gebucht.")}>Versenden & Bestand buchen</Button>
      </div>}

      {["DISPATCHED", "ARRIVED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "CREDIT_PENDING"].includes(status) && <div className="grid gap-1 sm:grid-cols-2">
        <Input value={refund} onChange={(event) => setRefund(event.target.value)} placeholder="Erstattung €" inputMode="decimal" />
        <Input value={creditReference} onChange={(event) => setCreditReference(event.target.value)} placeholder="Gutschrift / Referenz" />
        <Button className="sm:col-span-2" size="sm" variant="outline" disabled={pending || !refund.trim()} onClick={() => run(() => recordSupplierReturnRefundAction(supplierReturnId, refund, creditReference))}>Erstattung speichern</Button>
      </div>}
    </div>
  );
}
