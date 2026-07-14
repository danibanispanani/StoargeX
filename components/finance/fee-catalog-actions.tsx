"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore, Download, PlayCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { activateFeeCatalogAction, archiveFeeCatalogAction, importBundledFeeCatalogAction } from "@/lib/actions/fee-catalogs";
import { recalculateProductPricingAction } from "@/lib/actions/marketplace-pricing";
import { Button } from "@/components/ui/button";

export function ImportFeeCatalogButton({ marketplaceCode, label }: { marketplaceCode: "EBAY_DE" | "KAUFLAND_DE"; label: string }) {
  const [pending, startTransition] = useTransition();
  return <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await importBundledFeeCatalogAction(marketplaceCode); if (result?.error) toast.error(result.error); else toast.success(result?.success); })}><Download />{pending ? "Importiert…" : label}</Button>;
}

export function ActivateFeeCatalogButton({ feeScheduleId }: { feeScheduleId: string }) {
  const [pending, startTransition] = useTransition();
  return <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await activateFeeCatalogAction(feeScheduleId); if (result?.error) toast.error(result.error); else toast.success(result?.success); })}>{pending ? <ArchiveRestore className="animate-pulse" /> : <PlayCircle />}{pending ? "Aktiviert…" : "Aktivieren"}</Button>;
}

export function ArchiveFeeCatalogButton({ feeScheduleId }: { feeScheduleId: string }) {
  const [pending, startTransition] = useTransition();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await archiveFeeCatalogAction(feeScheduleId); if (result?.error) toast.error(result.error); else toast.success(result?.success); })}><Archive />{pending ? "Archiviert…" : "Archivieren"}</Button>;
}

export function RecalculateStalePricingButton({ marketplaceCode }: { marketplaceCode: "EBAY_DE" | "KAUFLAND_DE" }) {
  const [pending, startTransition] = useTransition();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await recalculateProductPricingAction({ marketplaceCode, staleOnly: true }); if (result?.error) toast.error(result.error); else toast.success(result?.success); })}><RefreshCw className={pending ? "animate-spin" : ""} />Betroffene neu berechnen</Button>;
}
