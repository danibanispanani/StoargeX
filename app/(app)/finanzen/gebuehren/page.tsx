import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { hasMinRole } from "@/lib/roles";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivateFeeCatalogButton, ArchiveFeeCatalogButton, ImportFeeCatalogButton, RecalculateStalePricingButton } from "@/components/finance/fee-catalog-actions";
import { ImportExportBar } from "@/components/import-export/import-export-bar";

export default async function FeeCatalogsPage() {
  const { db, membership } = await requireOrg();
  const [schedules, mappingCount] = await Promise.all([
    db.feeSchedule.findMany({
      where: { marketplaceCode: { in: ["EBAY_DE", "KAUFLAND_DE"] } },
      include: {
        _count: { select: { categories: true, rules: true, pricingCalculations: true } },
        categories: {
          where: { externalCategoryId: { not: null } },
          orderBy: { officialName: "asc" },
          select: { id: true, externalCategoryId: true, officialName: true, parent: { select: { officialName: true } } },
        },
        rules: {
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          select: { id: true, feeCategoryId: true, shopModel: true, itemCondition: true, percentage: true, percentageAbove: true, tierThresholdCents: true, fixedOrderFeeCents: true, fixedItemFeeCents: true, listingFeeCents: true, validFrom: true, validUntil: true },
        },
      },
      orderBy: [{ marketplaceCode: "asc" }, { createdAt: "desc" }],
    }),
    db.productMarketplaceMapping.groupBy({ by: ["marketplaceCode", "status"], _count: true }),
  ]);
  const canManage = hasMinRole(membership.role, "ADMIN");
  const activeByMarketplace = new Map(
    schedules.filter((schedule) => schedule.status === "ACTIVE" && schedule.marketplaceCode).map((schedule) => [schedule.marketplaceCode, schedule])
  );
  return <div className="space-y-5"><PageHeader eyebrow="Finanzen / Regelwerk" title="Gebührenkataloge" description="Quellengebundene, versionierte eBay- und Kaufland-Regeln mit geprüftem Aktivierungsprozess." actions={<div className="flex flex-wrap gap-2">{canManage ? <><ImportExportBar table="gebuehrenregeln" /><ImportFeeCatalogButton marketplaceCode="EBAY_DE" label="eBay-Startkatalog importieren" /><ImportFeeCatalogButton marketplaceCode="KAUFLAND_DE" label="Kaufland-Startkatalog importieren" /></> : null}</div>} />
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"><section className="overflow-x-auto border bg-card"><div className="grid min-w-[54rem] grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_14rem] gap-3 border-b bg-muted/35 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span>Katalog / Quelle</span><span>Status</span><span>Kategorien</span><span>Regeln</span><span>Aktion</span></div>{schedules.length === 0 ? <div className="p-8 text-center"><p className="font-medium">Keine Katalogversion importiert</p><p className="mt-1 text-sm text-muted-foreground">Ein Import erzeugt zunächst einen Entwurf. Erst der separate Review-/Aktivierungsschritt macht Regeln für Rechner verfügbar.</p></div> : schedules.map((schedule) => { const active = schedule.marketplaceCode ? activeByMarketplace.get(schedule.marketplaceCode) : undefined; return <div key={schedule.id} className="grid min-w-[54rem] grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_14rem] gap-3 border-b px-4 py-3 text-sm last:border-0"><div><div className="font-medium">{schedule.name}</div><div className="truncate text-xs text-muted-foreground">{schedule.sourceUrl}</div><div className="mt-1 font-mono text-[10px] text-muted-foreground">SHA-256 {schedule.sourceHash?.slice(0, 16)}… · Abruf {schedule.retrievedAt?.toLocaleDateString("de-DE") ?? "–"}</div>{active && active.id !== schedule.id ? <div className="mt-1 text-xs text-muted-foreground">Gegen aktiv: Kategorien {signedDelta(schedule._count.categories - active._count.categories)} · Regeln {signedDelta(schedule._count.rules - active._count.rules)}</div> : null}</div><div><Badge variant={schedule.status === "ACTIVE" ? "default" : schedule.status === "REVIEW_REQUIRED" ? "destructive" : "outline"}>{schedule.status}</Badge></div><div className="font-mono">{schedule._count.categories}</div><div className="font-mono">{schedule._count.rules}</div><div className="flex flex-wrap gap-1">{canManage && schedule.status !== "ACTIVE" && schedule.status !== "ARCHIVED" ? <><ActivateFeeCatalogButton feeScheduleId={schedule.id} /><ArchiveFeeCatalogButton feeScheduleId={schedule.id} /></> : schedule.status === "ACTIVE" ? <><Button asChild size="sm" variant="outline"><Link href={schedule.marketplaceCode === "EBAY_DE" ? "/finanzen/preisrechner/ebay" : "/finanzen/preisrechner/kaufland"}>Testberechnung</Link></Button>{canManage && (schedule.marketplaceCode === "EBAY_DE" || schedule.marketplaceCode === "KAUFLAND_DE") ? <RecalculateStalePricingButton marketplaceCode={schedule.marketplaceCode} /> : null}</> : null}</div></div>; })}</section>
      <aside className="space-y-4"><div className="border bg-card p-4"><h2 className="text-sm font-medium">Produktzuordnungen</h2><dl className="mt-3 space-y-2 text-sm">{mappingCount.length === 0 ? <p className="text-muted-foreground">Noch keine Zuordnungen.</p> : mappingCount.map((item) => <div key={`${item.marketplaceCode}-${item.status}`} className="flex justify-between gap-2"><dt className="text-muted-foreground">{item.marketplaceCode} · {item.status}</dt><dd className="font-mono">{item._count}</dd></div>)}</dl><Button asChild variant="outline" size="sm" className="mt-4 w-full"><Link href="/produkte?view=kalkulation">In Produkten prüfen</Link></Button></div><div className="border bg-card p-4 text-xs text-muted-foreground"><h2 className="mb-2 text-sm font-medium text-foreground">Aktivierungsregel</h2><p>Nur normalisierte, validierte Regeln können aktiviert werden. Eine Aktivierung archiviert die vorherige Version und markiert betroffene Kalkulations-Snapshots als veraltet.</p><p className="mt-2">Referenzierte Kataloge werden nicht gelöscht.</p></div></aside>
    </div>
    {schedules.filter((schedule) => schedule.status === "ACTIVE").map((schedule) => {
      const categoryById = new Map(schedule.categories.map((category) => [category.id, category]));
      return <details key={`details-${schedule.id}`} className="border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Aktives Regelwerk prüfen · {schedule.name}</summary>
        <div className="grid border-t xl:grid-cols-[20rem_minmax(0,1fr)]">
          <section className="border-b p-4 xl:border-b-0 xl:border-r"><h2 className="text-sm font-medium">Kategorien</h2><div className="mt-3 max-h-[32rem] space-y-2 overflow-auto">{schedule.categories.map((category) => <div key={category.id} className="border-b pb-2 text-xs"><div className="font-medium">{category.officialName}</div><div className="text-muted-foreground">{category.parent?.officialName ?? "Ohne Gruppe"} · {category.externalCategoryId}</div></div>)}</div></section>
          <section className="overflow-x-auto p-4"><h2 className="text-sm font-medium">Regeln</h2><table className="sx-datatable mt-3 min-w-[60rem] w-full"><thead><tr><th>Kategorie</th><th>Shop / Zustand</th><th>Prozent</th><th>Staffel</th><th>Fix</th><th>Listing</th><th>Gültigkeit</th></tr></thead><tbody>{schedule.rules.map((rule) => { const category = rule.feeCategoryId ? categoryById.get(rule.feeCategoryId) : undefined; return <tr key={rule.id}><td><div>{category?.officialName ?? "Allgemein"}</div><div className="text-xs text-muted-foreground">{category?.externalCategoryId ?? "–"}</div></td><td>{rule.shopModel ?? "Alle"} · {rule.itemCondition ?? "Alle"}</td><td className="font-mono">{rule.percentage.toString()} %</td><td className="font-mono">{rule.percentageAbove ? `${rule.percentageAbove.toString()} % ab ${formatCents(rule.tierThresholdCents)}` : "–"}</td><td className="font-mono">Bestellung {formatCents(rule.fixedOrderFeeCents)} · Artikel {formatCents(rule.fixedItemFeeCents)}</td><td className="font-mono">{formatCents(rule.listingFeeCents)}</td><td>{rule.validFrom.toLocaleDateString("de-DE")} – {rule.validUntil?.toLocaleDateString("de-DE") ?? "offen"}</td></tr>; })}</tbody></table></section>
        </div>
      </details>;
    })}
  </div>;
}

function signedDelta(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function formatCents(value: number | null) {
  if (value === null) return "–";
  return `${(value / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
