import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  PackageSearch,
  ReceiptText,
  RotateCcw,
  Scale,
  Users,
  WalletCards,
} from "lucide-react";
import { formatEuro } from "@/lib/calculations";
import type {
  InsightDateRange,
  InsightSnapshot,
  InsightTone,
} from "@/lib/dashboard/insight-dashboard";
import { cn } from "@/lib/utils";

function percent(value: number | null) {
  if (value === null) return "Neu";
  if (value === 0) return "±0 %";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE")} %`;
}

function Delta({
  value,
  positiveIsGood = true,
}: {
  value: number | null;
  positiveIsGood?: boolean;
}) {
  const positive = value !== null && value > 0;
  const negative = value !== null && value < 0;
  return (
    <span
      className={cn(
        "font-mono text-[11px] font-semibold",
        positive && (positiveIsGood ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"),
        negative && (positiveIsGood ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"),
        !positive && !negative && "text-muted-foreground"
      )}
    >
      {percent(value)}
    </span>
  );
}

function Section({
  eyebrow,
  title,
  description,
  definition,
  action,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  definition: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t-2 border-foreground/80 bg-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-teal-700 dark:text-teal-300">
            {eyebrow}
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <details className="relative text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              Berechnung
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-72 border bg-popover p-3 leading-5 text-popover-foreground shadow-lg">
              {definition}
            </div>
          </details>
          {action ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1 text-xs font-medium hover:text-transit-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {action.label}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Sparkline({
  rows,
  value,
  label,
}: {
  rows: Array<{ date: string; revenueCents: number; profitCents: number }>;
  value: "revenueCents" | "profitCents";
  label: string;
}) {
  const values = rows.map((row) => row[value]);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const points = values
    .map((item, index) => {
      const x = rows.length <= 1 ? 0 : (index / (rows.length - 1)) * 100;
      const y = 34 - ((item - min) / range) * 30;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 36"
      preserveAspectRatio="none"
      className="h-14 w-full"
      role="img"
      aria-label={label}
    >
      <line x1="0" x2="100" y1="34" y2="34" className="stroke-border" strokeWidth="0.7" />
      <polyline
        points={points}
        fill="none"
        className="stroke-transit-teal"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function AttentionQueue({ items }: { items: InsightSnapshot["attention"] }) {
  const toneStyle: Record<InsightTone, string> = {
    critical: "border-l-red-500 bg-red-500/[0.04]",
    warning: "border-l-cargo-amber bg-cargo-amber/[0.05]",
    neutral: "border-l-slate-400 bg-muted/20",
  };
  return (
    <section aria-labelledby="attention-title" className="border-t-2 border-red-500 bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-red-700 dark:text-red-300">
            Today / Aufmerksamkeit
          </p>
          <h2 id="attention-title" className="mt-1 font-display text-lg font-semibold">
            Was jetzt geklärt werden sollte
          </h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {items.length} Signale
        </span>
      </div>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 text-sm">
          <CircleCheck className="size-5 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="font-medium">Keine akuten Aufmerksamkeitspunkte</p>
            <p className="text-xs text-muted-foreground">
              Fristen, Buchungen, Bestand und offene Vorgänge sind aktuell unauffällig.
            </p>
          </div>
        </div>
      ) : (
        <ol className="divide-y">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className={cn(
                  "group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-l-4 px-3 py-3 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
                  toneStyle[item.tone]
                )}
              >
                <span className="min-w-8 font-mono text-xl font-semibold tabular-nums">
                  {item.count}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LedgerMetric({
  label,
  value,
  detail,
  href,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-end justify-between gap-4 border-b px-4 py-3 outline-none last:border-b-0 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-sm font-semibold tabular-nums",
          tone === "positive" && "text-emerald-700 dark:text-emerald-300",
          tone === "negative" && "text-red-700 dark:text-red-300"
        )}
      >
        {value}
      </span>
    </Link>
  );
}

export function InsightCockpit({
  snapshot,
  range,
  dataBasis,
}: {
  snapshot: InsightSnapshot;
  range: InsightDateRange;
  dataBasis: { salesRows: number; inventoryRows: number; generatedAt: Date };
}) {
  const inventoryTotal =
    snapshot.inventory.available +
    snapshot.inventory.reserved +
    snapshot.inventory.inspection +
    snapshot.inventory.defective;
  const distributionMax = Math.max(1, ...snapshot.margin.distribution.map((item) => item.count));
  const memberMax = Math.max(1, ...snapshot.team.byMember.map((item) => item.openCount));

  return (
    <div className="space-y-4">
      <AttentionQueue items={snapshot.attention} />

      <Section
        eyebrow="Trade Pulse"
        title="Handelsleistung im gewählten Zeitraum"
        description="Umsatz, Gewinn und Verkaufsdynamik im direkten Vergleich zur gleich langen Vorperiode."
        definition={`Umsatz = Summe VK brutto. Gewinn = gespeicherter serverseitiger Verkaufssnapshot. Marge = Gewinn ÷ Umsatz. Vergleich: (${range.label} minus unmittelbar vorheriger gleich langer Zeitraum) ÷ Vorperiode.`}
        action={{ label: "Verkäufe öffnen", href: "/verkauf" }}
      >
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="border-b p-4 lg:border-r lg:border-b-0">
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Umsatz brutto</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {formatEuro(snapshot.trade.revenueCents)}
                </p>
                <Delta value={snapshot.trade.revenueChangePercent} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Gewinn</p>
                <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", snapshot.trade.profitCents < 0 && "text-red-700 dark:text-red-300")}>
                  {formatEuro(snapshot.trade.profitCents)}
                </p>
                <Delta value={snapshot.trade.profitChangePercent} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Gewinnmarge</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {snapshot.trade.marginPercent.toLocaleString("de-DE")} %
                </p>
                <span className="text-[11px] text-muted-foreground">Gewinn ÷ Umsatz</span>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Verkäufe</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {snapshot.trade.salesCount}
                </p>
                <Delta value={snapshot.trade.salesChangePercent} />
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium">7-Tage-Trend</span>
                <span className="text-muted-foreground">Umsatz</span>
              </div>
              <Sparkline
                rows={snapshot.trade.trend7}
                value="revenueCents"
                label="Umsatzverlauf der letzten 7 Tage"
              />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{snapshot.trade.trend7[0]?.date ?? "–"}</span>
                <span>{snapshot.trade.trend7.at(-1)?.date ?? "–"}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium">30-Tage-Trend</span>
                <span className="text-muted-foreground">Umsatz</span>
              </div>
              <Sparkline
                rows={snapshot.trade.trend30}
                value="revenueCents"
                label="Umsatzverlauf der letzten 30 Tage"
              />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{snapshot.trade.trend30[0]?.date ?? "–"}</span>
                <span>{snapshot.trade.trend30.at(-1)?.date ?? "–"}</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          eyebrow="Inventory Health"
          title="Bestandslage"
          description="Reale Bestands-Buckets, Reichweitensignale und gebundenes Eigenkapital – ohne synthetischen Score."
          definition="Mengen stammen aus InventoryPosition-Buckets. Niedriger Bestand: Produkt hatte mehr als eine Einheit und liegt jetzt bei höchstens dem Organisations-Schwellenwert. Langsam: seit mehr als 90 Tagen verfügbar. Gebundenes Kapital: verfügbarer Eigenbestand × EK netto."
          action={{ label: "Lager öffnen", href: "/lager?view=stock" }}
        >
          <div className="p-4">
            <div
              className="flex h-3 overflow-hidden bg-muted"
              role="img"
              aria-label={`${snapshot.inventory.available} verfügbar, ${snapshot.inventory.reserved} reserviert, ${snapshot.inventory.inspection} in Prüfung, ${snapshot.inventory.defective} defekt`}
            >
              {[
                ["bg-transit-teal", snapshot.inventory.available],
                ["bg-cargo-amber", snapshot.inventory.reserved],
                ["bg-sky-500", snapshot.inventory.inspection],
                ["bg-red-500", snapshot.inventory.defective],
              ].map(([className, value], index) => (
                <span
                  key={index}
                  className={String(className)}
                  style={{ width: `${inventoryTotal ? (Number(value) / inventoryTotal) * 100 : 0}%` }}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Verfügbar", snapshot.inventory.available],
                ["Reserviert", snapshot.inventory.reserved],
                ["Prüfung", snapshot.inventory.inspection],
                ["Defekt", snapshot.inventory.defective],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="font-mono text-lg font-semibold">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t">
            <LedgerMetric label="Niedriger Bestand" value={String(snapshot.inventory.lowStockProducts)} detail="Produkte am Schwellenwert" href="/produkte?preset=low-stock" />
            <LedgerMetric label="Langsame Artikel" value={`${snapshot.inventory.slowStockUnits} Stk.`} detail="Seit mehr als 90 Tagen verfügbar" href="/lager?view=stock&alter=langsam" />
            <LedgerMetric label="Gebundenes Kapital" value={formatEuro(snapshot.inventory.boundCapitalCents)} detail="Verfügbarer Eigenbestand × EK netto" href="/lager?view=stock" />
          </div>
        </Section>

        <Section
          eyebrow="Margin Quality"
          title="Qualität der Marge"
          description="Verteilung statt Durchschnitt allein: Belastungen und Ausreißer bleiben sichtbar."
          definition="Marge je Verkauf = Gewinn ÷ VK brutto. Zielmarge = 10 %. Gebührenbelastung = Plattform- und Zahlungsgebühren ÷ Umsatz. Versandbelastung = eigene Versandkosten ÷ Umsatz. Produktranking verteilt den Verkaufsgewinn gleich auf enthaltene Produkte."
          action={{ label: "Finanzansicht", href: "/verkauf?preset=finances" }}
        >
          <div className="grid sm:grid-cols-2">
            <div className="border-b p-4 sm:border-r sm:border-b-0">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="font-mono text-xl font-semibold">{snapshot.trade.marginPercent.toLocaleString("de-DE")} %</p>
                  <p className="text-[11px] text-muted-foreground">Ø Gewinnmarge</p>
                </div>
                <div>
                  <p className="font-mono text-xl font-semibold">{snapshot.margin.feeLoadPercent.toLocaleString("de-DE")} %</p>
                  <p className="text-[11px] text-muted-foreground">Gebührenlast</p>
                </div>
                <div>
                  <p className="font-mono text-xl font-semibold">{snapshot.margin.shippingLoadPercent.toLocaleString("de-DE")} %</p>
                  <p className="text-[11px] text-muted-foreground">Versandlast</p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {snapshot.margin.distribution.map((item) => (
                  <div key={item.label} className="grid grid-cols-[52px_1fr_24px] items-center gap-2 text-[11px]">
                    <span>{item.label}</span>
                    <span className="h-2 bg-muted">
                      <span className="block h-full bg-transit-teal" style={{ width: `${(item.count / distributionMax) * 100}%` }} />
                    </span>
                    <span className="text-right font-mono">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold">Produkte nach Gewinnbeitrag</p>
              <div className="mt-3 space-y-2">
                {snapshot.margin.strongestProducts.slice(0, 3).map((item, index) => (
                  <div key={`strong-${item.label}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate"><span className="mr-2 font-mono text-muted-foreground">{index + 1}</span>{item.label}</span>
                    <span className="font-mono font-medium text-emerald-700 dark:text-emerald-300">{formatEuro(item.profitCents)}</span>
                  </div>
                ))}
                {snapshot.margin.weakestProducts.filter((item) => item.profitCents < 0).slice(0, 2).map((item) => (
                  <div key={`weak-${item.label}`} className="flex items-center justify-between gap-2 border-t pt-2 text-xs">
                    <span className="truncate text-red-700 dark:text-red-300">{item.label}</span>
                    <span className="font-mono font-medium text-red-700 dark:text-red-300">{formatEuro(item.profitCents)}</span>
                  </div>
                ))}
                {snapshot.trade.salesCount === 0 ? <p className="text-xs text-muted-foreground">Keine Verkäufe im Zeitraum.</p> : null}
              </div>
              <Link href="/verkauf?preset=finances" className="mt-4 inline-flex text-[11px] font-medium underline underline-offset-4">
                {snapshot.margin.belowTargetCount} Verkäufe unter 10 % Zielmarge
              </Link>
            </div>
          </div>
        </Section>
      </div>

      <Section
        eyebrow="Return Pressure"
        title="Retourendruck – fachlich getrennt"
        description="Kundenretouren zeigen Absatzverlust; Lieferantenretouren zeigen Fristen, Kapitalbindung und Erstattungsrisiko."
        definition="Kundenquote = im Zeitraum gemeldete Kundenretouren ÷ Verkäufe im Zeitraum; Verlust = gespeicherter serverseitiger Return.lossCents. Lieferantenwerte umfassen alle nicht terminalen Vorgänge; offene Erstattung = erwartet minus tatsächlich, mindestens null."
      >
        <div className="grid md:grid-cols-2">
          <div className="border-b p-4 md:border-r md:border-b-0">
            <div className="flex items-center gap-2">
              <RotateCcw className="size-4 text-transit-teal" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Kundenretouren</h3>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div><p className="font-mono text-xl font-semibold">{snapshot.returns.customer.ratePercent.toLocaleString("de-DE")} %</p><p className="text-[11px] text-muted-foreground">Retourenquote</p></div>
              <div><p className="font-mono text-xl font-semibold">{snapshot.returns.customer.openCount}</p><p className="text-[11px] text-muted-foreground">offen</p></div>
              <div><p className="font-mono text-xl font-semibold text-red-700 dark:text-red-300">{formatEuro(snapshot.returns.customer.lossCents)}</p><p className="text-[11px] text-muted-foreground">Verlust</p></div>
            </div>
            <Link href="/retouren/kunden?preset=finances" className="mt-4 inline-flex items-center gap-1 text-xs font-medium hover:text-transit-teal">Finanzansicht öffnen <ArrowRight className="size-3" /></Link>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2">
              <PackageSearch className="size-4 text-cargo-amber" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Lieferantenretouren</h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><p className="font-mono text-xl font-semibold">{snapshot.returns.supplier.openCount}</p><p className="text-[11px] text-muted-foreground">offen</p></div>
              <div><p className="font-mono text-xl font-semibold">{snapshot.returns.supplier.deadlineCount}</p><p className="text-[11px] text-muted-foreground">Frist ≤ 14 Tage</p></div>
              <div><p className="font-mono text-lg font-semibold">{formatEuro(snapshot.returns.supplier.openRefundCents)}</p><p className="text-[11px] text-muted-foreground">Erstattung offen</p></div>
              <div><p className="font-mono text-lg font-semibold">{formatEuro(snapshot.returns.supplier.boundCapitalCents)}</p><p className="text-[11px] text-muted-foreground">Kapital gebunden</p></div>
            </div>
            <Link href="/retouren/lieferanten?preset=refund" className="mt-4 inline-flex items-center gap-1 text-xs font-medium hover:text-transit-teal">Erstattungen öffnen <ArrowRight className="size-3" /></Link>
          </div>
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          eyebrow="Cash and Cost"
          title="Liquidität und Betriebskosten"
          description="Ergebnis vor und nach gebuchten Betriebsausgaben sowie noch zu realisierende Beträge."
          definition="Einmalig/wiederkehrend = gebuchte Expense-Vorkommen im Zeitraum, unterschieden über Recurrence bzw. erzeugte Vorkommen. Gewinn nach Ausgaben = Verkaufsgewinn minus Betriebsausgaben brutto. Erwartete Auszahlung = Umsatz minus Plattform- und Zahlungsgebühren aus PENDING, PAID oder SHIPPED. Cash-Recovery = bereits erhaltene Lieferantenerstattung ÷ erwartete Lieferantenerstattung."
          action={{ label: "Ausgaben öffnen", href: "/finanzen/ausgaben" }}
        >
          <div>
            <LedgerMetric label="Gewinn vor Ausgaben" value={formatEuro(snapshot.cash.profitBeforeExpensesCents)} detail="Verkaufssnapshots im Zeitraum" href="/verkauf?preset=finances" />
            <LedgerMetric label="Einmalige Ausgaben" value={`− ${formatEuro(snapshot.cash.oneTimeExpenseCents)}`} detail="Gebuchte Einzelvorgänge" href="/finanzen/ausgaben" />
            <LedgerMetric label="Wiederkehrende Kosten" value={`− ${formatEuro(snapshot.cash.recurringExpenseCents)}`} detail="Regel oder erzeugtes Vorkommen" href="/finanzen/ausgaben" />
            <LedgerMetric label="Gewinn nach Betriebsausgaben" value={formatEuro(snapshot.cash.profitAfterExpensesCents)} detail="Gewinn minus gebuchte Ausgaben" href="/finanzen/ausgaben" tone={snapshot.cash.profitAfterExpensesCents >= 0 ? "positive" : "negative"} />
            <LedgerMetric label="Erwartete Auszahlungen" value={formatEuro(snapshot.cash.expectedPayoutCents)} detail="Umsatz minus Gebühren · PENDING, PAID oder SHIPPED" href="/verkauf?preset=payout" />
            <LedgerMetric label="Offene Schulden" value={formatEuro(snapshot.cash.openDebtCents)} detail="Betrag minus bereits beglichen" href="/schulden?preset=due" />
            <LedgerMetric
              label="Cash-Recovery"
              value={
                snapshot.cash.cashRecoveryPercent === null
                  ? "–"
                  : `${snapshot.cash.cashRecoveryPercent.toLocaleString("de-DE")} %`
              }
              detail={
                snapshot.cash.cashRecoveryPercent === null
                  ? "Keine erwartete Lieferantenerstattung als Basis"
                  : "Erhaltene relativ zu erwarteter Lieferantenerstattung"
              }
              href="/retouren/lieferanten?preset=refund"
            />
          </div>
        </Section>

        <Section
          eyebrow="Team Flow"
          title="Arbeitsfluss im Team"
          description="Verantwortung, Überfälligkeit und reale Durchlaufzeit statt erzwungener Prozentwerte."
          definition="Offen = OPEN oder IN_PROGRESS. Überfällig = offene Aufgabe mit Frist vor heute. Blocker = offene Aufgabe mit Priorität Dringend. Durchlaufzeit = Mittelwert completedAt minus createdAt aller im Zeitraum erledigten Aufgaben."
          action={{ label: "Aufgaben öffnen", href: "/aufgaben?view=team" }}
        >
          <div className="grid grid-cols-2 border-b sm:grid-cols-4">
            {[
              [snapshot.team.openCount, "Offen", Users],
              [snapshot.team.overdueCount, "Überfällig", Clock3],
              [snapshot.team.blockerCount, "Blocker", CircleAlert],
              [snapshot.team.averageCycleDays === null ? "–" : `${snapshot.team.averageCycleDays} T`, "Ø Durchlaufzeit", Scale],
            ].map(([value, label, Icon], index) => {
              const MetricIcon = Icon as typeof Users;
              return (
                <div key={String(label)} className={cn("p-4", index < 3 && "border-r")}>
                  <MetricIcon className="mb-2 size-4 text-muted-foreground" aria-hidden="true" />
                  <p className="font-mono text-xl font-semibold">{String(value)}</p>
                  <p className="text-[11px] text-muted-foreground">{String(label)}</p>
                </div>
              );
            })}
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold">Offene Aufgaben nach Mitglied</p>
            <div className="mt-3 space-y-2">
              {snapshot.team.byMember.map((item) => (
                <div key={item.label} className="grid grid-cols-[minmax(80px,140px)_1fr_26px] items-center gap-2 text-[11px]">
                  <span className="truncate">{item.label}</span>
                  <span className="h-2 bg-muted"><span className="block h-full bg-cargo-amber" style={{ width: `${(item.openCount / memberMax) * 100}%` }} /></span>
                  <span className="text-right font-mono">{item.openCount}</span>
                </div>
              ))}
              {snapshot.team.byMember.length === 0 ? <p className="text-xs text-muted-foreground">Keine offenen Aufgaben.</p> : null}
            </div>
          </div>
        </Section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-y bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ReceiptText className="size-3" aria-hidden="true" />
          Datenbasis: {dataBasis.salesRows.toLocaleString("de-DE")} Verkaufsbelege inkl. Vergleich · {dataBasis.inventoryRows.toLocaleString("de-DE")} Bestandspositionen
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono">
          <WalletCards className="size-3" aria-hidden="true" />
          Berechnet {dataBasis.generatedAt.toLocaleString("de-DE")}
        </span>
      </footer>
    </div>
  );
}
