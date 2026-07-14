import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { MarketplaceAccountDialog, MarketplaceAccountToggle } from "@/components/settings/marketplace-account-dialog";

export default async function MarketplaceAccountsPage() {
  const { db, membership } = await requireOrg();
  const accounts = await db.marketplaceAccount.findMany({ include: { platform: true, defaultFeeSchedule: true }, orderBy: [{ active: "desc" }, { displayName: "asc" }] });
  const canEdit = hasMinRole(membership.role, "ADMIN");
  return <div className="space-y-5"><PageHeader eyebrow="Verwaltung / Marktplätze" title="Marktplatzkonten" description="Mehrere eBay- und Kaufland-Konten mit getrennten Gebühren-, Versand- und Steuerdefaults." actions={canEdit ? <MarketplaceAccountDialog /> : null} />
    <div className="border bg-card"><div className="hidden grid-cols-[minmax(14rem,1fr)_10rem_10rem_10rem_16rem] gap-3 border-b bg-muted/35 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:grid"><span>Konto</span><span>Marktplatz</span><span>Profil</span><span>Katalog</span><span>Aktionen</span></div>
      {accounts.length === 0 ? <div className="p-8 text-center"><p className="font-medium">Noch kein Marktplatzkonto</p><p className="mt-1 text-sm text-muted-foreground">Lege ein Konto an, bevor du einen Marktplatz-Rechner verwendest.</p></div> : accounts.map((account) => {
        const value = { id: account.id, marketplaceCode: account.marketplaceCode, displayName: account.displayName, externalAccountId: account.externalAccountId, accountType: account.accountType, marketplaceCountry: account.marketplaceCountry, sellerProfile: account.sellerProfile, shopModel: account.shopModel, taxProfile: account.taxProfile, standardCondition: account.standardCondition, defaultShippingCostCents: account.defaultShippingCostCents, defaultPackagingCostCents: account.defaultPackagingCostCents, promotedListingsDefault: account.promotedListingsDefault, defaultAdvertisingPercent: Number(account.defaultAdvertisingPercent), active: account.active };
        return <div key={account.id} className="grid gap-3 border-b px-4 py-3 last:border-0 md:grid-cols-[minmax(14rem,1fr)_10rem_10rem_10rem_16rem] md:items-center"><div><div className="font-medium">{account.displayName}</div><div className="text-xs text-muted-foreground">{account.externalAccountId || "Keine externe Kennung"}</div></div><div>{account.marketplaceCode === "EBAY_DE" ? "eBay.de" : account.marketplaceCode === "KAUFLAND_DE" ? "Kaufland.de" : account.platform.name}</div><div className="text-sm">{account.shopModel || "–"}</div><div><Badge variant={account.defaultFeeSchedule?.status === "ACTIVE" ? "default" : "outline"}>{account.defaultFeeSchedule?.version ?? "nicht zugewiesen"}</Badge></div><div className="flex flex-wrap gap-1">{canEdit ? <><MarketplaceAccountDialog account={value} /><MarketplaceAccountToggle account={value} /></> : <Badge variant="outline">Nur Lesen</Badge>}</div></div>;
      })}
    </div>
    <p className="text-xs text-muted-foreground">Monatliche Shop- und Basic/Plus-Gebühren werden als Betriebsausgaben geführt und nie automatisch auf Produktkalkulationen verteilt.</p>
  </div>;
}
