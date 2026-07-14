"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { saveMarketplaceAccountAction, toggleMarketplaceAccountAction } from "@/lib/actions/marketplace-accounts";
import type { ActionState } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface MarketplaceAccountEditorValue {
  id: string;
  marketplaceCode: string | null;
  displayName: string;
  externalAccountId: string | null;
  accountType: string;
  marketplaceCountry: string | null;
  sellerProfile: string | null;
  shopModel: string | null;
  taxProfile: string | null;
  standardCondition: string | null;
  defaultShippingCostCents: number | null;
  defaultPackagingCostCents: number | null;
  promotedListingsDefault: boolean;
  defaultAdvertisingPercent: number;
  active: boolean;
}

export function MarketplaceAccountDialog({ account }: { account?: MarketplaceAccountEditorValue }) {
  const [open, setOpen] = useState(false);
  const [marketplaceCode, setMarketplaceCode] = useState(account?.marketplaceCode ?? "EBAY_DE");
  const action = saveMarketplaceAccountAction.bind(null, account?.id ?? null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  useEffect(() => { if (state?.success) { toast.success(state.success); setOpen(false); } }, [state]);
  const isEbay = marketplaceCode === "EBAY_DE";
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant={account ? "outline" : "default"}>{account ? <Pencil /> : <Plus />}{account ? "Bearbeiten" : "Konto anlegen"}</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{account ? account.displayName : "Marktplatzkonto anlegen"}</DialogTitle><DialogDescription>Keine Secrets: Zugangsdaten bleiben ausschließlich im Credential-Tresor.</DialogDescription></DialogHeader><form action={formAction} className="grid gap-4 sm:grid-cols-2">
    {state?.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
    {account ? <input type="hidden" name="marketplaceCode" value={marketplaceCode} /> : null}
    <SelectField label="Marktplatz" name="marketplaceCode" value={marketplaceCode} onChange={setMarketplaceCode} disabled={Boolean(account)}><option value="EBAY_DE">eBay.de</option><option value="KAUFLAND_DE">Kaufland.de</option></SelectField>
    <Field label="Anzeigename" name="displayName" defaultValue={account?.displayName} required />
    <Field label="Externe Accountkennung" name="externalAccountId" defaultValue={account?.externalAccountId ?? ""} />
    <SelectField label="Kontotyp" name="accountType" defaultValue={account?.accountType ?? "BUSINESS"}><option value="BUSINESS">Gewerblich</option><option value="PRIVATE">Privat</option><option value="MANAGED">Verwaltet</option><option value="OTHER">Sonstig</option></SelectField>
    <Field label="Marktplatzland" name="marketplaceCountry" defaultValue={account?.marketplaceCountry ?? "DE"} maxLength={2} />
    {isEbay ? <><SelectField label="Verkäuferstatus" name="sellerProfile" defaultValue={account?.sellerProfile ?? "COMMERCIAL_ABOVE_STANDARD"}><option value="COMMERCIAL_ABOVE_STANDARD">Top / überdurchschnittlich</option><option value="COMMERCIAL_BELOW_STANDARD">Unterdurchschnittlich (nicht vollständig unterstützt)</option><option value="PRIVATE">Privat (nicht vollständig unterstützt)</option></SelectField><SelectField label="Shopmodell" name="shopModel" defaultValue={account?.shopModel ?? "NONE"}><option value="NONE">Kein Shop</option><option value="BASIC">Basis-Shop</option><option value="TOP">Top-Shop</option><option value="PREMIUM">Premium-Shop</option><option value="PLATINUM">Platin-Shop</option></SelectField></> : <><input type="hidden" name="sellerProfile" value="COMMERCIAL" /><SelectField label="Abo-Modell" name="shopModel" defaultValue={account?.shopModel ?? "BASIC"}><option value="BASIC">Basic</option><option value="PLUS">Plus</option></SelectField></>}
    <SelectField label="Steuerprofil" name="taxProfile" defaultValue={account?.taxProfile ?? "VAT_REGISTERED"}><option value="PRIVATE">Privat</option><option value="SMALL_BUSINESS">Kleinunternehmer</option><option value="VAT_REGISTERED">Gewerblich mit Umsatzsteuer</option></SelectField>
    <SelectField label="Standardzustand" name="standardCondition" defaultValue={account?.standardCondition ?? ""}><option value="">Kein Standard</option><option value="NEW">Neu</option><option value="OPEN_BOX">Geöffnete Verpackung</option><option value="REFURBISHED">Generalüberholt</option><option value="USED">Gebraucht</option><option value="DEFECTIVE">Defekt</option></SelectField>
    <Field label="Standardversand (€)" name="defaultShippingCost" defaultValue={formatInput(account?.defaultShippingCostCents)} inputMode="decimal" />
    <Field label="Standardverpackung (€)" name="defaultPackagingCost" defaultValue={formatInput(account?.defaultPackagingCostCents)} inputMode="decimal" />
    {isEbay ? <><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="promotedListingsDefault" defaultChecked={account?.promotedListingsDefault} /> Basisanzeige standardmäßig aktiv</label><Field label="Standard-Anzeigensatz (%)" name="defaultAdvertisingPercent" defaultValue={String(account?.defaultAdvertisingPercent ?? 0).replace(".", ",")} inputMode="decimal" /></> : <input type="hidden" name="defaultAdvertisingPercent" value="0" />}
    <Button type="submit" className="sm:col-span-2" disabled={pending}>{pending ? "Speichert…" : "Konto speichern"}</Button>
  </form></DialogContent></Dialog>;
}

export function MarketplaceAccountToggle({ account }: { account: Pick<MarketplaceAccountEditorValue, "id" | "active" | "displayName"> }) {
  const [pending, startTransition] = useTransition();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { const result = await toggleMarketplaceAccountAction(account.id, !account.active); if (result?.error) toast.error(result.error); else toast.success(result?.success); })}><Power />{account.active ? "Deaktivieren" : "Aktivieren"}</Button>;
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) { return <div className="space-y-2"><Label htmlFor={`account-${name}`}>{label}</Label><Input id={`account-${name}`} name={name} {...props} /></div>; }
function SelectField({ label, name, children, value, onChange, defaultValue, disabled }: { label: string; name: string; children: React.ReactNode; value?: string; onChange?: (value: string) => void; defaultValue?: string; disabled?: boolean }) { return <div className="space-y-2"><Label htmlFor={`account-${name}`}>{label}</Label><select id={`account-${name}`} name={name} value={value} defaultValue={value === undefined ? defaultValue : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} disabled={disabled} className="border-input h-9 w-full border bg-background px-3 text-sm disabled:opacity-60">{children}</select></div>; }
function formatInput(cents: number | null | undefined) { return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","); }
