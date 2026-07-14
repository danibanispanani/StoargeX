"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Calculator, CheckCircle2, PackageSearch, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { convertPricingCalculationToProductAction, saveMarketplacePricingAction, updateProductFromPricingAction, type SaveMarketplacePricingInput } from "@/lib/actions/marketplace-pricing";
import { euroToCents, formatEuro } from "@/lib/calculations";
import {
  calculateMarketplacePrice,
  findBreakEven,
  findMaximumPurchasePrice,
  findTargetMarginPrice,
  type MarketplaceFeeRule,
  type MarketplaceItemCondition,
  type MarketplacePricingResult,
} from "@/lib/services/marketplace-pricing-service";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AccountOption {
  id: string;
  displayName: string;
  sellerProfile: string;
  shopModel: string | null;
  marketplaceCountry: string | null;
  taxProfile: "PRIVATE" | "SMALL_BUSINESS" | "VAT_REGISTERED" | null;
  standardCondition: string | null;
  defaultShippingCostCents: number | null;
  defaultPackagingCostCents: number | null;
  promotedListingsDefault: boolean;
  defaultAdvertisingBasisPoints: number;
}

interface ProductOption {
  id: string;
  name: string;
  brand: string | null;
  variant: string | null;
  size: string | null;
  ean: string | null;
  defaultPriceCents: number | null;
  defaultCondition: string | null;
  defaultShippingCostCents: number | null;
  defaultPackagingCostCents: number | null;
  lastReferenceSalePriceCents: number | null;
  mapping: { feeCategoryId: string; externalCategoryId: string; status: string } | null;
}

type RuleDto = Omit<MarketplaceFeeRule, "validFrom" | "validUntil"> & { validFrom: string; validUntil: string | null };

export function MarketplaceCalculator({ marketplaceCode, catalog, accounts, categories, rules, products, organizationDefaults }: {
  marketplaceCode: "EBAY_DE" | "KAUFLAND_DE";
  catalog: { id: string; version: string; sourceUrl: string | null; retrievedAt: string | null } | null;
  accounts: AccountOption[];
  categories: Array<{ id: string; externalCategoryId: string; officialName: string; groupName: string | null }>;
  rules: RuleDto[];
  products: ProductOption[];
  organizationDefaults: { inputTaxDeductible: boolean; saleTaxRateBasisPoints: number };
}) {
  const [inputMode, setInputMode] = useState<"PRODUCT" | "FREE">("PRODUCT");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryRecordId, setCategoryRecordId] = useState("");
  const [condition, setCondition] = useState<MarketplaceItemCondition>(parseCondition(accounts[0]?.standardCondition ?? null) ?? "NEW");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseMode, setPurchaseMode] = useState<"GROSS" | "NET">("GROSS");
  const [salePrice, setSalePrice] = useState("");
  const [buyerShipping, setBuyerShipping] = useState("0,00");
  const [ownShipping, setOwnShipping] = useState(accounts[0]?.defaultShippingCostCents === null || accounts[0]?.defaultShippingCostCents === undefined ? "0,00" : centsInput(accounts[0].defaultShippingCostCents));
  const [packaging, setPackaging] = useState(accounts[0]?.defaultPackagingCostCents === null || accounts[0]?.defaultPackagingCostCents === undefined ? "0,00" : centsInput(accounts[0].defaultPackagingCostCents));
  const [otherCosts, setOtherCosts] = useState("0,00");
  const [quantity, setQuantity] = useState("1");
  const [listingFeeMode, setListingFeeMode] = useState<"AUTO" | "YES" | "NO">("AUTO");
  const [promoted, setPromoted] = useState(accounts[0]?.promotedListingsDefault ?? false);
  const [promotedPercent, setPromotedPercent] = useState(((accounts[0]?.defaultAdvertisingBasisPoints ?? 0) / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 }));
  const [internationalPercent, setInternationalPercent] = useState("0");
  const [manualFee, setManualFee] = useState("");
  const [targetMargin, setTargetMargin] = useState("10");
  const [priceSource, setPriceSource] = useState<SaveMarketplacePricingInput["priceSource"]>(null);
  const [freeProductName, setFreeProductName] = useState("");
  const [savedCalculationId, setSavedCalculationId] = useState<string | null>(null);
  const [result, setResult] = useState<(MarketplacePricingResult & { breakEvenCents: number; targetPriceCents: number | null; maxPurchaseCents: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  useEffect(() => {
    const requestedProductId = searchParams.get("productId");
    if (requestedProductId && products.some((item) => item.id === requestedProductId)) {
      selectProduct(requestedProductId);
      const requestedPurchase = searchParams.get("purchasePriceCents");
      if (requestedPurchase && /^\d+$/.test(requestedPurchase)) setPurchasePrice(centsInput(Number(requestedPurchase)));
      const requestedCondition = searchParams.get("condition");
      const parsedCondition = parseCondition(requestedCondition);
      if (parsedCondition) setCondition(parsedCondition);
    }
    // Query-prefill is intentionally applied once; later edits remain local simulation state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAccount = accounts.find((item) => item.id === accountId) ?? null;
  const selectedCategory = categories.find((item) => item.id === categoryRecordId) ?? null;
  const hydratedRules = useMemo(() => rules.map((rule) => ({ ...rule, validFrom: new Date(rule.validFrom), validUntil: rule.validUntil ? new Date(rule.validUntil) : null })), [rules]);
  const filteredProducts = useMemo(() => {
    const needle = productSearch.trim().toLocaleLowerCase("de-DE");
    if (!needle) return products;
    return products.filter((product) => [product.name, product.brand, product.variant, product.size, product.ean]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase("de-DE").includes(needle)));
  }, [productSearch, products]);

  function selectAccount(id: string) {
    setAccountId(id);
    const account = accounts.find((item) => item.id === id);
    if (!account) return;
    const accountCondition = parseCondition(account.standardCondition);
    if (accountCondition) setCondition(accountCondition);
    if (account.defaultShippingCostCents !== null) setOwnShipping(centsInput(account.defaultShippingCostCents));
    if (account.defaultPackagingCostCents !== null) setPackaging(centsInput(account.defaultPackagingCostCents));
    setPromoted(account.promotedListingsDefault);
    setPromotedPercent((account.defaultAdvertisingBasisPoints / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 }));
  }

  function selectProduct(id: string) {
    setProductId(id);
    const product = products.find((item) => item.id === id);
    if (!product) return;
    if (product.defaultPriceCents !== null) setPurchasePrice(centsInput(product.defaultPriceCents));
    const productCondition = parseCondition(product.defaultCondition);
    if (productCondition) setCondition(productCondition);
    if (product.defaultShippingCostCents !== null) setOwnShipping(centsInput(product.defaultShippingCostCents));
    if (product.defaultPackagingCostCents !== null) setPackaging(centsInput(product.defaultPackagingCostCents));
    if (product.lastReferenceSalePriceCents !== null) setSalePrice(centsInput(product.lastReferenceSalePriceCents));
    if (product.mapping?.status === "CONFIRMED") setCategoryRecordId(product.mapping.feeCategoryId);
  }

  function buildInput() {
    if (!catalog) throw new Error("Kein aktiver Gebührenkatalog. Importiere und aktiviere zuerst eine geprüfte Version unter Gebühren.");
    if (!selectedAccount) throw new Error("Bitte zuerst ein aktives Marktplatzkonto konfigurieren und auswählen.");
    if (!selectedCategory) throw new Error("Bitte eine Gebührenkategorie auswählen.");
    const taxProfile = selectedAccount.taxProfile;
    return {
      marketplaceCode,
      marketplaceAccountId: selectedAccount.id,
      sellerProfile: selectedAccount.sellerProfile,
      shopModel: selectedAccount.shopModel,
      categoryId: selectedCategory.externalCategoryId,
      condition: marketplaceCode === "EBAY_DE" ? condition : null,
      calculatedAt: new Date(),
      purchasePriceCents: parseMoney(purchasePrice),
      purchasePriceMode: purchaseMode,
      purchaseTaxRateBasisPoints: 1900,
      inputTaxDeductible: taxProfile === "VAT_REGISTERED" && organizationDefaults.inputTaxDeductible,
      salePriceCents: parseMoney(salePrice),
      buyerShippingCents: parseMoney(buyerShipping),
      ownShippingCents: parseMoney(ownShipping),
      packagingCents: parseMoney(packaging),
      otherDirectCostsCents: parseMoney(otherCosts),
      quantity: Math.max(1, Number.parseInt(quantity, 10) || 1),
      saleTaxRateBasisPoints: taxProfile === "VAT_REGISTERED" ? organizationDefaults.saleTaxRateBasisPoints : 0,
      listingFeeMode,
      promotedListingBasisPoints: marketplaceCode === "EBAY_DE" && promoted ? parsePercentBasisPoints(promotedPercent) : 0,
      internationalFeeBasisPoints: marketplaceCode === "EBAY_DE" ? parsePercentBasisPoints(internationalPercent) : 0,
      manualPlatformFeeGrossCents: manualFee.trim() ? parseMoney(manualFee) : undefined,
      rules: hydratedRules,
    } as const;
  }

  function calculate() {
    try {
      const input = buildInput();
      const calculated = calculateMarketplacePrice(input);
      const breakEven = findBreakEven(input);
      const target = targetMargin.trim() ? findTargetMarginPrice(input, parsePercentBasisPoints(targetMargin)) : null;
      const maxPurchase = findMaximumPurchasePrice(input);
      setResult({ ...calculated, breakEvenCents: breakEven.salePriceCents, targetPriceCents: target?.salePriceCents ?? null, maxPurchaseCents: maxPurchase });
      setError(null);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Kalkulation fehlgeschlagen.");
    }
  }

  function save() {
    if (!result || !selectedCategory) return;
    let input;
    try { input = buildInput(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Kalkulation unvollständig."); return; }
    startTransition(async () => {
      const response = await saveMarketplacePricingAction({
        marketplaceCode,
        inputMode,
        productId: inputMode === "PRODUCT" && productId ? productId : null,
        marketplaceAccountId: input.marketplaceAccountId,
        feeCategoryId: selectedCategory.id,
        condition: marketplaceCode === "EBAY_DE" ? condition : null,
        purchasePriceCents: input.purchasePriceCents,
        purchasePriceMode: purchaseMode,
        salePriceCents: input.salePriceCents,
        buyerShippingCents: input.buyerShippingCents,
        ownShippingCents: input.ownShippingCents,
        packagingCents: input.packagingCents,
        otherDirectCostsCents: input.otherDirectCostsCents,
        quantity: input.quantity,
        listingFeeMode,
        promotedListingBasisPoints: input.promotedListingBasisPoints,
        internationalFeeBasisPoints: input.internationalFeeBasisPoints,
        manualPlatformFeeGrossCents: input.manualPlatformFeeGrossCents,
        priceSource,
        status: "IDEA",
        note: null,
      });
      if (response.error) toast.error(response.error);
      else { toast.success(response.success); setSavedCalculationId(response.calculationId ?? null); }
    });
  }

  function persistedInput(): SaveMarketplacePricingInput | null {
    if (!selectedCategory) return null;
    try {
      const input = buildInput();
      return { marketplaceCode, inputMode, productId: inputMode === "PRODUCT" && productId ? productId : null, marketplaceAccountId: input.marketplaceAccountId, feeCategoryId: selectedCategory.id, condition: marketplaceCode === "EBAY_DE" ? condition : null, purchasePriceCents: input.purchasePriceCents, purchasePriceMode: purchaseMode, salePriceCents: input.salePriceCents, buyerShippingCents: input.buyerShippingCents, ownShippingCents: input.ownShippingCents, packagingCents: input.packagingCents, otherDirectCostsCents: input.otherDirectCostsCents, quantity: input.quantity, listingFeeMode, promotedListingBasisPoints: input.promotedListingBasisPoints, internationalFeeBasisPoints: input.internationalFeeBasisPoints, manualPlatformFeeGrossCents: input.manualPlatformFeeGrossCents, priceSource, status: "IDEA", note: null };
    } catch { return null; }
  }

  const marketplaceLabel = marketplaceCode === "EBAY_DE" ? "eBay.de" : "Kaufland.de";
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <section className="border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div><h2 className="font-medium">Kalkulationsgrundlage</h2><p className="text-xs text-muted-foreground">Werte bleiben eine Simulation, bis du ausdrücklich speicherst.</p></div>
          {catalog ? <Badge variant="outline" className="font-mono">Katalog {catalog.version}</Badge> : <Badge variant="destructive">Kein aktiver Katalog</Badge>}
        </div>
        <div className="p-4 sm:p-5">
          <Tabs value={inputMode} onValueChange={(value) => { const next = parseInputMode(value); if (next) setInputMode(next); }}>
            <TabsList className="grid w-full grid-cols-2 sm:w-[28rem]"><TabsTrigger value="PRODUCT"><PackageSearch /> Gespeichertes Produkt</TabsTrigger><TabsTrigger value="FREE"><Calculator /> Freie Kalkulation</TabsTrigger></TabsList>
            <TabsContent value="PRODUCT" className="grid gap-3 pt-4 sm:grid-cols-2">
              <TextField label="Produkt suchen" value={productSearch} onChange={setProductSearch} placeholder="Name, Marke, Variante oder EAN" />
              <SelectField label="Produkt" value={productId} onChange={selectProduct}><option value="">Produkt auswählen…</option>{filteredProducts.map((product) => <option key={product.id} value={product.id}>{[product.name, product.variant, product.brand].filter(Boolean).join(" · ")}</option>)}</SelectField>
            </TabsContent>
            <TabsContent value="FREE" className="space-y-3 pt-4"><Alert><AlertDescription>Freie Kalkulation ohne Produktanlage. Eine spätere Übernahme erfolgt nur nach ausdrücklicher Bestätigung.</AlertDescription></Alert><TextField label="Produktname für optionale spätere Übernahme" value={freeProductName} onChange={setFreeProductName} placeholder="z. B. Fire TV Stick 4K" /></TabsContent>
          </Tabs>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SelectField label={`${marketplaceLabel}-Konto *`} value={accountId} onChange={selectAccount}><option value="">Konto auswählen…</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.displayName}</option>)}</SelectField>
            <SelectField label="Gebührenkategorie *" value={categoryRecordId} onChange={setCategoryRecordId}><option value="">Kategorie auswählen…</option>{renderCategoryOptions(categories)}</SelectField>
            {marketplaceCode === "EBAY_DE" ? <SelectField label="Artikelzustand" value={condition} onChange={(value) => { const next = parseCondition(value); if (next) setCondition(next); }}><option value="NEW">Neu</option><option value="OPEN_BOX">Geöffnete Verpackung</option><option value="REFURBISHED">Generalüberholt</option><option value="USED">Gebraucht</option><option value="DEFECTIVE">Defekt</option></SelectField> : <SelectField label="Marktplatzland" value={selectedAccount?.marketplaceCountry ?? "DE"} onChange={() => undefined} disabled><option value="DE">Deutschland</option></SelectField>}
            <SelectField label="Preisquelle (informativ)" value={priceSource ?? ""} onChange={(value) => setPriceSource(parsePriceSource(value))}><option value="">Keine Angabe</option><option value="EBAY">eBay</option><option value="IDEALO">idealo</option><option value="KAUFLAND">Kaufland</option><option value="EXPERIENCE">Eigener Erfahrungswert</option><option value="OTHER">Sonstige</option></SelectField>
          </div>

          <div className="mt-6 border-t pt-5"><h3 className="mb-4 text-sm font-medium">Preise und direkte Kosten</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MoneyField label="Einkaufspreis je Artikel *" value={purchasePrice} onChange={setPurchasePrice} />
            <SelectField label="Einkaufspreis ist" value={purchaseMode} onChange={(value) => { if (value === "GROSS" || value === "NET") setPurchaseMode(value); }}><option value="GROSS">Brutto</option><option value="NET">Netto</option></SelectField>
            <MoneyField label="Erwarteter Preis je Artikel *" value={salePrice} onChange={setSalePrice} />
            <MoneyField label="Käufer-Versand gesamt" value={buyerShipping} onChange={setBuyerShipping} />
            <MoneyField label="Eigene Versandkosten" value={ownShipping} onChange={setOwnShipping} />
            <MoneyField label="Verpackung" value={packaging} onChange={setPackaging} />
            <MoneyField label="Sonstige direkte Kosten" value={otherCosts} onChange={setOtherCosts} />
            <TextField label="Menge" value={quantity} onChange={setQuantity} type="number" min="1" />
          </div></div>

          {marketplaceCode === "EBAY_DE" ? <div className="mt-6 border-t pt-5"><h3 className="mb-4 text-sm font-medium">eBay-spezifisch</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField label="Angebotsgebühr" value={listingFeeMode} onChange={(value) => { if (value === "AUTO" || value === "YES" || value === "NO") setListingFeeMode(value); }}><option value="AUTO">Auto (keine unbelegte Gebühr)</option><option value="YES">Ja</option><option value="NO">Nein</option></SelectField>
            <label className="flex min-h-16 items-center gap-3 border px-3"><input type="checkbox" checked={promoted} onChange={(event) => setPromoted(event.target.checked)} className="size-4" /><span><span className="block text-sm font-medium">Basisanzeige</span><span className="text-xs text-muted-foreground">Nur prozentual, keine CPC-Logik</span></span></label>
            <TextField label="Basisanzeigen-Satz (%)" value={promotedPercent} onChange={setPromotedPercent} inputMode="decimal" disabled={!promoted} />
            <TextField label="Internationale Gebühr (%)" value={internationalPercent} onChange={setInternationalPercent} inputMode="decimal" title="Nur explizit aktivieren, wenn der Ziellandfall sicher unterstützt wird." />
          </div></div> : null}

          <details className="mt-6 border-t pt-4"><summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><SlidersHorizontal className="size-4" /> Erweiterte Kalkulation</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><TextField label="Zielmarge (%)" value={targetMargin} onChange={setTargetMargin} inputMode="decimal" /><MoneyField label="Manueller Plattformgebühren-Override brutto" value={manualFee} onChange={setManualFee} placeholder="leer = Katalog" /></div>{manualFee.trim() ? <Alert className="mt-4"><AlertTriangle /><AlertDescription>Der manuelle Override ersetzt die berechnete Plattformgebühr vollständig und wird im Snapshot ausdrücklich als manuelle Korrektur ausgewiesen.</AlertDescription></Alert> : null}</details>
          {error ? <Alert variant="destructive" className="mt-5"><AlertTriangle /><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="mt-6 flex flex-wrap gap-2"><Button onClick={calculate}><Calculator /> Berechnen</Button><Button variant="outline" onClick={save} disabled={!result || pending}><Save /> {pending ? "Speichert…" : "Kalkulation speichern"}</Button>{inputMode === "PRODUCT" && productId ? <Button variant="outline" disabled={!result || pending} onClick={() => { const payload = persistedInput(); if (!payload) return; startTransition(async () => { const response = await updateProductFromPricingAction(payload); if (response.error) toast.error(response.error); else toast.success(response.success); }); }}><PackageSearch /> Produktdaten aktualisieren</Button> : null}{inputMode === "FREE" && savedCalculationId ? <Button variant="outline" disabled={!freeProductName.trim() || pending} onClick={() => startTransition(async () => { const response = await convertPricingCalculationToProductAction(savedCalculationId, freeProductName); if (response.error) toast.error(response.error); else toast.success(response.success); })}><PackageSearch /> Als Produkt übernehmen</Button> : null}</div>
        </div>
      </section>
      <PricingResultPanel result={result} catalog={catalog} />
    </div>
  );
}

function PricingResultPanel({ result, catalog }: { result: (MarketplacePricingResult & { breakEvenCents: number; targetPriceCents: number | null; maxPurchaseCents: number }) | null; catalog: { version: string; sourceUrl: string | null } | null }) {
  if (!result) return <aside className="border bg-card p-6 xl:sticky xl:top-5"><div className="grid min-h-72 place-items-center text-center"><div><Calculator className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-medium">Noch keine Berechnung</h2><p className="mt-1 text-sm text-muted-foreground">Pflichtwerte ausfüllen und berechnen. Das Ergebnis erscheint hier ohne die Produktdaten zu verändern.</p></div></div></aside>;
  const profitable = result.profitCents >= 0;
  const feeRows: Array<[string, number]> = [
    ["Verkaufsprovision", result.fees.commissionNetCents],
    ["Fixer Bestellanteil", result.fees.fixedOrderNetCents],
    ["Feste Artikelgebühr", result.fees.fixedItemNetCents],
    ["Angebotsgebühr", result.fees.listingNetCents],
    ["Basisanzeige", result.fees.advertisingNetCents],
    ["Shop-Rabatt", -result.fees.shopDiscountNetCents],
    ["Gebühren-USt", result.fees.vatCents],
  ];
  const rows = feeRows.filter(([, cents]) => cents !== 0);
  const directCostRows: Array<[string, number]> = [
    ["Eigener Versand", result.directCosts.ownShippingCents],
    ["Verpackung", result.directCosts.packagingCents],
    ["Sonstige direkte Kosten", result.directCosts.otherCents],
  ];
  return <aside className="overflow-hidden border bg-card xl:sticky xl:top-5">
    <div className={profitable ? "border-b-4 border-emerald-600 p-5" : "border-b-4 border-destructive p-5"}><div className="flex items-center gap-2 text-sm font-medium">{profitable ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}{profitable ? "Gewinn" : "Verlust"}</div><p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{result.profitCents >= 0 ? "+" : "−"}{formatEuro(Math.abs(result.profitCents))}</p><p className="mt-1 text-sm text-muted-foreground">Gewinnmarge {formatPercent(result.profitMarginBasisPoints)}</p></div>
    <div className="grid grid-cols-2 border-b"><ResultMetric label="Mindestpreis je Artikel" value={formatEuro(result.breakEvenCents)} /><ResultMetric label="Voraussichtliche Auszahlung" value={formatEuro(result.expectedPayoutCents)} /></div>
    <div className="p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-medium">Gebühren und direkte Kosten</h3><span className="font-mono text-sm">{formatEuro(result.fees.platformGrossCents + result.directCosts.totalCents)}</span></div><dl className="mt-3 space-y-2">{rows.map(([label, cents]) => <div key={label} className="flex justify-between gap-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono tabular-nums">{formatEuro(cents)}</dd></div>)}{directCostRows.filter(([, cents]) => cents !== 0).map(([label, cents]) => <div key={label} className="flex justify-between gap-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono tabular-nums">{formatEuro(cents)}</dd></div>)}</dl>{result.warnings.includes("MANUAL_FEE_OVERRIDE") ? <Alert className="mt-4"><AlertTriangle /><AlertDescription>Manueller Gebührenwert aktiv: Die einzelnen Katalogbestandteile sind deshalb mit 0 ausgewiesen.</AlertDescription></Alert> : null}<div className="mt-4 border-t pt-3 text-xs text-muted-foreground"><p>Gewinnwirksame Gebühr: {formatEuro(result.fees.profitEffectiveCents)}</p><p>Bruttomarge: {formatEuro(result.grossMarginCents)} ({formatPercent(result.grossMarginBasisPoints)})</p>{result.targetPriceCents !== null ? <p>Zielmargenpreis je Artikel: {formatEuro(result.targetPriceCents)}</p> : null}<p>Maximaler EK je Artikel ohne Verlust: {formatEuro(result.maxPurchaseCents)}</p></div></div>
    <div className="border-t bg-muted/35 px-5 py-3 text-xs text-muted-foreground">Katalog {catalog?.version ?? "–"} · Regel {result.ruleId.slice(0, 12)}…{catalog?.sourceUrl ? <> · <a href={catalog.sourceUrl} target="_blank" rel="noreferrer" className="underline">Quelle</a></> : null}</div>
  </aside>;
}

function ResultMetric({ label, value }: { label: string; value: string }) { return <div className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</div></div>; }
function MoneyField({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) { return <TextField label={`${label} (€)`} value={value} onChange={onChange} inputMode="decimal" placeholder="0,00" {...props} />; }
function TextField({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) { const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`; return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} /></div>; }
function SelectField({ label, value, onChange, children, disabled }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; disabled?: boolean }) { const id = `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`; return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="border-input h-9 w-full border bg-background px-3 text-sm disabled:opacity-60">{children}</select></div>; }
function renderCategoryOptions(categories: Array<{ id: string; officialName: string; groupName: string | null }>) { const groups = new Map<string, typeof categories>(); for (const item of categories) { const group = item.groupName ?? "Gebührenkategorien"; groups.set(group, [...(groups.get(group) ?? []), item]); } return [...groups].map(([group, items]) => <optgroup key={group} label={group}>{items.map((item) => <option key={item.id} value={item.id}>{item.officialName}</option>)}</optgroup>); }
function parseMoney(value: string) { return value.trim() ? euroToCents(value) : 0; }
function centsInput(cents: number) { return (cents / 100).toFixed(2).replace(".", ","); }
function parsePercentBasisPoints(value: string) { const normalized = value.trim().replace(",", "."); const parsed = Number(normalized || "0"); if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Ungültiger Prozentsatz."); return Math.round(parsed * 100); }
function formatPercent(value: number | null) { return value === null ? "–" : `${(value / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`; }
function parseCondition(value: string | null): MarketplaceItemCondition | null { switch (value) { case "NEW": case "OPEN_BOX": case "REFURBISHED": case "USED": case "DEFECTIVE": return value; default: return null; } }
function parseInputMode(value: string): "PRODUCT" | "FREE" | null { return value === "PRODUCT" || value === "FREE" ? value : null; }
function parsePriceSource(value: string): SaveMarketplacePricingInput["priceSource"] { switch (value) { case "EBAY": case "IDEALO": case "KAUFLAND": case "EXPERIENCE": case "OTHER": return value; default: return null; } }
