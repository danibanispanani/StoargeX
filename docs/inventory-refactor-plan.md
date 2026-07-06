# Inventory-Refactor – Analyse & Umbauplan

> **Phase 1 abgeschlossen** (Migration `20260706180000_inventory_datamodel_phase1`):
> Neue Modelle `DocumentSequence`, `Purchase`, `PurchaseLine`,
> `InventoryPosition`, `OwnedStockLot`, `ConsignmentLot` additiv angelegt,
> `Product` um `size` erweitert. Alle sechs neuen Tabellen mit RLS-Policies
> (`tenant_isolation` + `bypass_rls`, `FORCE ROW LEVEL SECURITY`) und
> CHECK-Constraints (nicht-negative Mengen). Zentraler Service unter
> `lib/services/document-number-service.ts` erzeugt concurrency-sichere
> Dokumentnummern per atomarem `upsert + increment`. Format:
> `L/K/E/V/R/SCH-{JJ}-{NNNN}`. **Bestehende Modelle und APIs bleiben
> unverändert produktiv** – keine Umschaltung in dieser Phase.

> **Status:** Nur Analyse. Es wurden **keine** fachlichen Änderungen an
> Prisma-Schema, Migrationen, Server Actions, Business-Services, UI oder Tests
> vorgenommen. Baseline-Checks am Ausgangspunkt:
>
> - `npm run lint` → grün
> - `npx tsc --noEmit` → grün
> - `npm test` → 44/44 grün
> - `npm run build` → grün (Next.js 15.5, Turbopack, alle Routen)
>
> Letzter Commit auf `main`: `cb49e4a Prepare Vercel Supabase deployment`.
> Bekannte, nicht committete Feinschliffe (Sticky-Header, farbcodierte Selects,
> Bulk-Delete-Buttons) sind **kein Teil dieser Analyse** und bleiben
> unangetastet.

---

## 1. Ist-Architektur (Kurzform)

Die aktuelle Warenwirtschaft steckt in drei Kern-Modellen und einer
Verbindungs-Tabelle:

```
         Product (Katalogvorlage, nur Prefill – kein FK zur Wirtschaft)

┌────────────────────────────────────┐
│ StockItem                          │   – eine Zeile = eine physische Einheit
│  sku, title, model, variant, size, │   – Menge>1 = mehrere Zeilen mit
│  purchasePriceCents / _NetCents,   │     fortlaufenden LagerIDs (L-{JJ}-{NNN})
│  status (11 Werte),                │   – Listing n:m via StockItemListing
│  kauf/retoure/paymentMethod,       │
│  taxRateId?                        │
└────────────┬───────────────────────┘
             │ (SetNull)
             │
┌────────────▼───────────────────────┐        SaleItem
│ Sale                               │◀──n──▶ (org, saleId,
│  orderNumber, soldAt,              │        stockItemId? XOR consignmentId?,
│  salePriceCents / saleNetCents,    │        ekNetCents-Snapshot)
│  taxRatePercent,                   │
│  marginCents / profitCents,        │        Alt-Feld: sale.stockItemId (SetNull)
│  platformFee(Gross/Net)Cents,      │
│  feeInclVat, shippingCostCents,    │
│  status (6), invoiceCreated,       │
│  payoutRecipient …                 │
└─────┬─────────────────┬────────────┘
      │                 │
   Return           ConsignmentInventory (Legacy-Sale-FK + linkedSaleIds[])
   (loss auto)      (eigene sku, quantity/sold/returned/defective,
                     agreedPayoutCents als "EK" beim Verkauf)

Debt  (frei, Auto-Insert aus Stock-/Sale-Actions über refId + description)
```

**Zentrale Snapshots** stehen fest in Sale/SaleItem:
`ekNetCents` je Position, `saleNetCents`, `platformFeeNetCents`, `marginCents`,
`profitCents`, `taxRatePercent`. Der Sale hält keine kanonische Bestandsbrücke
mehr zu einer Einheit – nur den historischen Alt-FK `stockItemId` (SetNull, nur
für Migrationsdaten).

### 1.a Prisma-Modelle im Detail

| Modell | Wichtigste Felder | Beziehungen | Verwendet in Actions | Verwendet in UI |
|---|---|---|---|---|
| **`Product`** | name, variant, category, ean, defaultPriceCents, imageUrls | Organization | `products.ts` | `/produkte`, `ProductPicker` in Lager-/Sale-Dialog |
| **`StockItem`** | sku (`L-{JJ}-{NNN}`), title, model, variant, size, ean, purchasePriceCents (+Net), inputTaxDeductible, paymentMethod, kaufStatus, retoureStatus, status, imageUrls, taxRateId?, supplier, purchaseDate | Organization, TaxRate?, StockItemListing[n:m], Sale? (Legacy), SaleItem[], ConsignmentInventory? | `stock.ts`, `sales.ts` (Bestand + EK-Snapshot), `returns.ts` (Restock), `import.ts` | `/lager`, `StockTable`, `StockItemDialog`, `ProductPicker` |
| **`StockItemListing`** | organizationId, stockItemId, platformId | StockItem, Platform | `stock.ts` (toggleListing, bulkUpdate) | `/lager` (dyn. Plattform-Spalten & Bulk) |
| **`Sale`** | orderNumber, soldAt, salePriceCents / saleNetCents, taxRatePercent, margin/profit, platformFee(+Net)Cents, feeInclVat, shipping, payoutRecipient, buyerCountry, status, invoiceCreated, Alt-`stockItemId`? | Platform, Carrier?, TaxRate?, SaleItem[], Return[], ConsignmentInventory[] (Legacy) | `sales.ts`, `returns.ts`, `import.ts`, `reporting.ts`, `activity.ts` | `/verkauf`, `SaleDialog`, `SaleFilterBar`, `/retouren`, `/konsignation` |
| **`SaleItem`** | saleId, `stockItemId?` XOR `consignmentId?`, ekNetCents (Snapshot) | Sale, StockItem?, ConsignmentInventory? | `sales.ts`, `returns.ts`, `import.ts`, `reporting.ts` (Top-Products) | `/verkauf` (Modelle & LagerIDs), Retouren-Titel, Konsignation-Umsatz |
| **`Return`** | saleId, requestedAt, reason, refundAmountCents, returnShippingCents, lossCents, status (5+1 Legacy), restocked | Sale (Cascade) | `returns.ts` | `/retouren` |
| **`ConsignmentInventory`** | sku, consignorName, itemTitle, quantity / sold / returned / defective, priceTiers (JSON), linkedSaleIds[], commissionPercent?, agreedPayoutCents?, status, Legacy-`stockItemId?`/`saleId?` | Organization, SaleItem[] | `consignment.ts`, `sales.ts` (dekrementiert quantity, push linkedSaleIds) | `/konsignation`, `SaleDialog` (Picker) |
| **`Debt`** | debtDate, refId (Lager-/Order-ID), kind (KAUF/VERKAUF/SONSTIGES), quantity, amountCents/paidCents, entryStatus (IO/FEHLT), debtor/creditor, status, description, settledAt | Organization | `debts.ts` (manuell) + Auto-Insert aus `stock.ts` & `sales.ts` | `/schulden`, Dashboard-Saldo |
| **`Platform`** | name, defaultFeePercent, active | Organization, Sale, StockItemListing, Credential | `catalog-settings.ts` | Lager-Listing-Spalten, `/verkauf`, Settings |
| **`ShippingRate`** | carrierName, name, zone, countries[], baseCents, perKgCents, maxWeightKg, surcharges (JSON), active | Organization | `shipping.ts` | `/versand`, Preis-Prefill im SaleDialog |
| **`TaxRate`** | name, ratePercent, country?, isDefault | Organization, StockItem, Sale | `tax-rates.ts` | Settings, `resolveTaxRatePercent` |
| **`SelectOption`** | kind (PAYMENT_METHOD / PAYOUT_RECIPIENT / TASK_AREA), label, sortOrder, active | Organization | `catalog-settings.ts`, `lib/options.ts` (Lazy Seed) | Settings, ZM-Select, Payout-Datalist |
| **`Organization`** | orderIdCounter, stockIdCounter, lowStockThreshold, orderIdFormat, subscriptionTier, Stripe-Ids | – | `register.ts`, `stock.ts` (Counter), `sales.ts` (Counter), `organization.ts` | überall |
| **`AuditLog`** | action (~40 Typen), entityType/-Id, before/after (JSON), userId?, ipAddress? | Organization, User? | `lib/audit.ts`, praktisch alle Actions | `/dashboard` Aktivitäts-Widget (`lib/activity.ts`) |

### 1.b Vorhandene Automatismen (Ist-Zustand)

1. **Wareneingang (`createStockItemAction`)** – Menge>1 legt N Rows mit
   fortlaufenden LagerIDs an, EK-Netto wird berechnet, Listings werden erstellt.
   Wenn `paymentMethodCreatesDebt(zm)` (alles außer "Firma…") → automatischer
   `Debt`-Eintrag `kind=KAUF`, `debtor="GbR"`, `creditor=zm`, `refId=SKU-Range`.
2. **Verkauf (`createSaleAction`)** – Positionen aus `stock:<id>` XOR
   `consignment:<id>`. EK = Summe der Position-Snapshots. `orderIdCounter++`,
   OrderID-Format vorlagenbasiert. Danach:
   - `stockItem.updateMany(status="SOLD", quantity=0)` für alle Lager-Positionen
   - `consignmentInventory`: quantity−=1, soldQuantity+=1, `push linkedSaleIds`
   - Optionaler `Debt`-Auto-Insert `kind=VERKAUF`, `debtor=payoutRecipient`,
     `creditor="GbR"` bei Auszahlung an Person
3. **Retoure (`updateReturnStatusAction`)** – Bei `RESTOCKED`: alle Lager-
   Positionen des Sales bekommen `status="RETURNED"`, `quantity=1`.
4. **Retoure erfassen (`createReturnAction`)** – `calcReturnLoss` mit Snapshots
   des Sales (`saleGross`, `taxRatePercent`, `platformFeeNet`, `shippingCost`).
   Optional Restock in derselben TX.
5. **Import Verkauf (`importVerkauf`)** – Löst LagerIDs per SKU auf, setzt
   Bestände auf SOLD, legt aber **keine** SaleItems für nicht gefundene SKUs an
   (Alt-Excel-Daten).
6. **Aktivitätsverlauf (`lib/activity.ts`)** – 30+ AuditLog-Templates rendern
   `orderNumber` / `sku` / `title` / `label` aus `after`/`before`.

---

## 2. Soll-Architektur

```
Product ─┐
         │  1:n
         ▼
      Purchase ─── 1:n ── PurchaseLine                (Beleg des Einkaufs)
                              │
                              │ produces
                              ▼
                    InventoryPosition             (kanonische Bestandsbrücke)
                       │        │
                       │        │
                       ▼        ▼
              OwnedStockLot   ConsignmentLot         (physisches Lot)
                       │        │
                       └──┬─────┘
                          ▼
                   InventoryMovement                  (Bestandsjournal)

              Sale ── 1:n ── SaleLine
                                 │
                                 │ 1:n
                                 ▼
                        SaleLineAllocation            (welche Position wie viel)
                                 │
                          ┌──────┴─────────┐
                          │                │
                       Return ── ReturnLine (── ReturnAllocation)
                                                     │
                                                     └── Debt (relational, keine Freitext-Kopplung)

Querschnitt: DocumentSequence  (typisierte Zählernummern, atomare Reservation)
Import:      ImportBatch → ImportRow → SourceReference (auf jede erzeugte Row)
```

**Kern-Idee:**

- **Product** trennt Katalog von Bestand.
- **Purchase / PurchaseLine** erfasst Beleg + Position (statt Kopfdaten am
  StockItem).
- **InventoryPosition** ist die einzige Bestandsbrücke, an der Verkäufe,
  Retouren und Bewegungen ansetzen; sie zeigt entweder auf ein
  **OwnedStockLot** (unser Eigentum) oder ein **ConsignmentLot** (Fremdbestand).
- **InventoryMovement** ist das append-only Bestandsjournal (IN, OUT, RETURN,
  ADJUST, TRANSFER).
- **SaleLineAllocation** erlaubt Teilverkäufe eines Lots und ist die
  Grundlage für **ReturnAllocation** (Retoure pro physischer Einheit).
- **DocumentSequence** ersetzt die zwei Integer-Counter auf `Organization`
  (`stockIdCounter`, `orderIdCounter`) durch typisierte, RLS-sichere Sequenzen
  (`STOCK`, `SALE`, `PURCHASE`, `RETURN`, `CONSIGNMENT`).
- **ImportBatch** kapselt einen Import mit Dry-Run-Historie, jede erzeugte
  Zeile bekommt eine **SourceReference**.
- **Debt** bleibt bestehen, wird aber durch relationale Verknüpfungen ergänzt
  (`saleId?`, `purchaseId?`, `returnId?`) statt Freitext-`refId`.

---

## 3. Mapping Altmodell → Neumodell

| Alt (heute) | Neu | Anmerkung |
|---|---|---|
| `StockItem` (physische Einheit + Kopfdaten) | **`OwnedStockLot`** (physisches Lot) + **`InventoryPosition`** (Bestandsbrücke) + **`Purchase`/`PurchaseLine`** (Beleg) | 1 StockItem-Row → 1 InventoryPosition mit `lotSize=1`; die Einkaufs-Kopfdaten (Datum, Händler, ZM, Beleg) wandern nach `Purchase`; `title`/`variant`/`ean`/`size`/Bilder werden Produkt-Referenz. |
| `StockItem.status` (11 Werte, gemischt fachlich/physisch) | **`OwnedStockLot.condition`** (Zustand: OK/RETURNED/CANCELLED/WRITTEN_OFF) + **`InventoryPosition.availableQty`** (Bestand) | Fachliche Status wie "gelagert-R/-D" werden zu Attributen der Position/Lot; "SOLD" ergibt sich aus `availableQty=0`. |
| `StockItem.quantity` (fast immer 1) | **`OwnedStockLot.originalQty`** + **`InventoryPosition.availableQty`** | Ein Lot mit N Einheiten statt N Einzelzeilen; bricht Menge>1-Konvention aus Block 1. |
| `StockItem.kaufStatus / retoureStatus` | bleibt in einer schlanken Domain-Tabelle (Purchase.kaufStatus / Return.retoureStatus) | Bleibt fachlich, wandert an die richtige Domäne. |
| `StockItem.paymentMethod` + Auto-Debt | **`Purchase.paymentMethod`** + `Debt(purchaseId=…)` relational | Automatik bleibt inhaltlich identisch, refId wird FK. |
| `StockItemListing` | bleibt (evtl. an `OwnedStockLot` gehängt) | Kein struktureller Konflikt. |
| `ConsignmentInventory` (Zähler + eigene sku) | **`ConsignmentLot`** + **`InventoryPosition`** | Zähler `quantity/sold/returned/defective` ergeben sich aus `availableQty` + `InventoryMovement`-Historie; `agreedPayoutCents` wird `ekCents` fürs Konsignations-Lot. |
| `ConsignmentInventory.linkedSaleIds[]` | entfällt zugunsten von `SaleLineAllocation.consignmentPositionId` | Umsatz je Konsignation berechnet sich aus Allocations. |
| `Sale` (Kopf + Snapshots) | **`Sale`** (nur Kopf) | Beträge (VK, netto, Gebühren, Marge, Gewinn) sind bereits Snapshots → bleiben. Alt-Feld `stockItemId` fällt weg. |
| `SaleItem` (position mit `stockItemId` XOR `consignmentId`) | **`SaleLine`** (Position ohne Bestandskopplung, mit Produkt/Preis) + **`SaleLineAllocation`** (welche `InventoryPosition` in welcher Menge) | 1 SaleItem → 1 SaleLine + 1 SaleLineAllocation mit `qty=1`. |
| `Sale.stockItemId` (Legacy, SetNull) | wird nach der Migration entfernt | Bereits jetzt SetNull. |
| `Return` + `Return.restocked` | **`Return`** + **`ReturnLine`** + **`ReturnAllocation`** (`InventoryPosition` + Menge zurück) | Restock erzeugt `InventoryMovement RETURN` statt globalem `stockItem.status=RETURNED`. |
| `Debt.refId` (Freitext, LagerID-Range oder OrderID) | **`Debt.purchaseId?` / `saleId?` / `returnId?`** (relational) | `refId` bleibt für Legacy-Anzeige; neue Einträge kommen von automatischen Triggern. |
| `Organization.stockIdCounter` / `orderIdCounter` | **`DocumentSequence(kind, year, value)`** | Atomar per `INCREMENT`; typsicher. |
| `IMPORT_TABLES` (Alias-Mapping in `lib/import-export.ts`) | **`ImportBatch` (DB-Row) + `ImportRow`** (Row-Snapshot mit Status) + **`SourceReference`** (auf jede erzeugte Domänen-Row) | Rückverfolgbarkeit inkl. Rückgängig-Machen. |

---

## 4. Risiken

**Priorität P1 (die drei größten technischen Risiken):**

1. **Bestandsstatus wird an zu vielen Stellen gesetzt.**
   `sales.ts`, `returns.ts` und `import.ts` schreiben direkt
   `stockItem.status = "SOLD" / "RETURNED"` und/oder `quantity`. Nach dem
   Umbau muss der Bestand ausschließlich über `InventoryMovement` fließen.
   Fehlerhafte Doppel-Buchungen (z. B. Retoure eines gleichzeitig als Alt-
   Verkauf importierten Artikels) sind das wahrscheinlichste Regressionsrisiko.
2. **Freitext-Kopplung Sale ↔ Konsignation ↔ Debt ↔ AuditLog.**
   `Debt.refId`, `ConsignmentInventory.linkedSaleIds[]`, `Debt.description` und
   die Activity-Templates in `lib/activity.ts` picken sich `orderNumber`/`sku`
   aus JSON-Snapshots. Beim Umbenennen der Sequenzen darf sich die Anzeige
   nicht ändern (Aktivitätsverlauf, Schulden-Liste, CSV-Export).
3. **Import als parallele Codebasis.**
   `lib/actions/import.ts` schreibt direkt in StockItem/Sale/Return/… und
   überspringt die Auto-Debts (Wareneinkauf), damit historische Excel-Daten
   nicht dutzendfach Schulden erzeugen. Der Umbau muss die "still-import"-
   Semantik in `ImportBatch` explizit modellieren, sonst rechnet der
   Dashboard-Saldo bei Nach-Importen falsch.

**Weitere Risiken (P2):**

- Menge>1 vs. Menge=1: die neue Lot-Semantik kollidiert mit der bewussten
  Design-Entscheidung aus Block 1 ("jede Einheit = eine Zeile"). Die UI in
  `/lager` und die Bulk-Bar müssen darauf reagieren.
- `stockIdCounter` / `orderIdCounter` liegen auf `Organization`. Solange die
  neuen DocumentSequences parallel laufen, muss der höchste bestehende Wert
  als Startpunkt übernommen werden.
- Konsignation hat drei Alt-Referenzen (`stockItemId?`, `saleId?`,
  `linkedSaleIds[]`) plus eigene Zähler. Rückwärtskompatibilität für Reports
  ist nicht trivial.
- RLS-Policies pro neuer Tabelle: Migrations-Reihenfolge muss `ENABLE ROW
  LEVEL SECURITY` + `FORCE` + Policies enthalten (Muster liegt in den ersten
  drei Migrationen vor).
- `postageBooked` / `feesBooked` sind nur informative Booleans; sie dürfen
  nicht mit Bewegungen verwechselt werden.
- Recharts liest CSS-Vars ohne SSR-Fallback; unkritisch, aber der Dashboard-
  Refactor darf keine Server-Snapshots ins Chart schleusen.
- Test-Coverage: aktuell 44 Unit-Tests, alles Berechnung/Crypto – keine
  Integration; jede Bestandsänderung ist untested.

---

## 5. Migrationsreihenfolge (additiv, ohne Datenverlust)

**Regel:** Bis inkl. Phase 4 werden **keine** alten Tabellen/Spalten gedroppt.
Erst nach Phase 6 (End-to-End grün) fallen Legacy-Reste.

| Phase | Inhalt | Migration-Typ |
|---|---|---|
| **0** | Dieses Dokument. Baseline-Checks. Kein Code-Change. | – |
| **1** | Neue Tabellen additiv: `Purchase`, `PurchaseLine`, `OwnedStockLot`, `ConsignmentLot`, `InventoryPosition`, `InventoryMovement`, `SaleLine`, `SaleLineAllocation`, `ReturnLine`, `ReturnAllocation`, `DocumentSequence`, `ImportBatch`, `ImportRow`, `SourceReference`. RLS-Policies je Tabelle. **Keine** Änderung an alten Tabellen. | `CREATE TABLE`, RLS |
| **2** | Backfill-Script (idempotent): jede `StockItem`-Row → `Purchase` + `PurchaseLine` + `OwnedStockLot` + `InventoryPosition`. Jedes `SaleItem` → `SaleLine` + `SaleLineAllocation` + `InventoryMovement(OUT)`. Jede `Return` mit `restocked=true` → `InventoryMovement(RETURN)`. Jede `ConsignmentInventory` → `ConsignmentLot` + `InventoryPosition`. `DocumentSequence`-Startwerte aus `Organization.*Counter`. | Script + Read-only-Test |
| **3** | Neue Server Actions (`purchases.ts`, `inventory.ts`, neue `sales.ts` v2, neue `returns.ts` v2) schreiben in beide Modelle (dual write) und lesen nur noch aus dem neuen. Alt-Actions bleiben unverändert erreichbar. Feature-Flag `USE_NEW_INVENTORY=false` default. | Code, kein Migration |
| **4** | UI (`/lager`, `/verkauf`, `/retouren`, `/konsignation`, Dashboard) auf neue Lese-Endpoints umstellen; Schreib-Aktionen weiterhin dual. Import wird auf `ImportBatch` umgestellt (Rückgängig-Machen möglich). | Code |
| **5** | Feature-Flag auf `true`, dual-write bleibt zwei Wochen aktiv. End-to-End-Tests (Playwright) + neue Unit-Tests grün. | – |
| **6** | Alt-Spalten (`Sale.stockItemId`, `ConsignmentInventory.stockItemId/saleId/linkedSaleIds`, `Organization.stockIdCounter/orderIdCounter`, `Debt.refId` bleibt für Anzeige aber wird nicht mehr geschrieben) werden aus dem Schema entfernt. `StockItem` bleibt bis Phase 7 als Read-only-View. | `DROP COLUMN` |
| **7** | `StockItem` / `SaleItem` / alte `ConsignmentInventory` werden durch Views ersetzt (Kompatibilität für alte Exporte) oder final gedroppt, nachdem alle Reports auf die neuen Modelle laufen. | `DROP TABLE` / Views |

---

## 6. APIs, die angepasst werden müssen

| Datei | Betrifft | Änderungsart |
|---|---|---|
| `lib/actions/stock.ts` | `create/update/updateStatus/updateEntryStatus/toggleListing/bulkUpdate` | Neu implementieren gegen `Purchase`/`OwnedStockLot`/`InventoryPosition`; Auto-Debt via `purchaseId`. |
| `lib/actions/sales.ts` | `create/update/updateSaleStatus/updateInvoiceStatus/delete/toggleFlag` | SaleLines + Allocations statt SaleItem; `InventoryMovement(OUT)` statt `stockItem.status`. |
| `lib/actions/returns.ts` | `createReturnAction`, `updateReturnStatusAction`, `updateReturnAction` | Restock über `InventoryMovement(RETURN)`, `ReturnAllocation` je Einheit. |
| `lib/actions/consignment.ts` | `create`, `updateCounts`, `linkSales` | Zähler ergeben sich aus Movements; `linkSales` entfällt (implizit über Allocations). |
| `lib/actions/debts.ts` | `create` | Neue optionale FKs `purchaseId?/saleId?/returnId?`. |
| `lib/actions/import.ts` | `importLager/Verkauf/Retouren/Konsignation/Schulden` | Über `ImportBatch` + `SourceReference`, silent-mode-Flag beibehalten. |
| `lib/actions/register.ts` | Seed | `DocumentSequence`-Zeilen anlegen statt Counter. |
| `lib/actions/gdpr.ts` | Export/Delete | Neue Tabellen einschließen. |
| `lib/reporting.ts` | `loadDashboardKpis`, `loadRecentSales`, `loadOpenDebts`, `loadPlatformShare`, `loadTopProducts`, `loadLowStockAlerts`, `loadPurchaseVsSaleMonthly`, `loadQuarterlyComparison`, `loadDebtBalances` | Auf Sale/SaleLine/InventoryPosition umziehen; Low-Stock aus `InventoryPosition.availableQty`. |
| `lib/activity.ts` | Templates | Neue Actions ergänzen; alte behalten. |
| `lib/calculations.ts` | – | Rechenkern bleibt unverändert (nur reine Funktionen). |
| `lib/options.ts` | – | Unverändert. |
| `app/api/export/[table]/route.ts` | Alle sechs Tabellen | Muss beide Modelle exportieren, bis Phase 6. |
| `app/api/stripe/webhook/route.ts` | – | Unberührt. |

---

## 7. UI-Komponenten, die angepasst werden müssen

| Datei | Beobachtung |
|---|---|
| `app/(app)/lager/page.tsx` + `components/stock/stock-table.tsx` + `components/stock/stock-item-dialog.tsx` + `components/stock/stock-filter-bar.tsx` | Lot-fähig machen, wenn Menge>1 (Anzeige-Menge = `availableQty/originalQty`). Bulk-Update darf keine `status="SOLD"` mehr direkt setzen. Sticky-Header/-Column-Utilities aus `globals.css` (`sx-datatable`, `sx-sticky-0/1`) sind vorhanden. |
| `app/(app)/verkauf/page.tsx` + `components/sales/sale-dialog.tsx` + `sale-inline-selects.tsx` + `sale-filter-bar.tsx` | Position-Picker liest `InventoryPosition` statt Stock/Consignment separat. Preis-Prefill über `ShippingRate` unverändert. |
| `app/(app)/retouren/page.tsx` + `components/returns/*` | Retoure zeigt Positionen mit `ReturnAllocation`; Restock über Movement. |
| `app/(app)/konsignation/page.tsx` + `components/consignment/*` | Zähler-Anzeige aus Movements; `Verkäufe verknüpfen`-Dialog entfällt zugunsten der Standard-Allocation. |
| `app/(app)/schulden/page.tsx` + `components/debts/*` | Refactor zeigt „Bezug" als Link auf Sale/Purchase/Return statt Freitext. Bestehende `refId` bleibt lesbar. |
| `app/(app)/dashboard/page.tsx` + `components/dashboard/*` | KPIs, Diagramme und `LowStockAlert` müssen über die neuen Aggregationen laufen. |
| `components/import-export/import-export-bar.tsx` | Erweitert um `ImportBatch`-Status („Rückgängig machen"). |
| `components/products/product-picker.tsx` | Unverändert. |
| `components/reports/activity-widget.tsx` + `activity-filter.tsx` | Neue Aktionstypen in `ACTIVITY_GROUPS` ergänzen. |
| `components/settings/*` (`low-stock-card`, `dropdown-options-card`, `tax-rates-card`, `order-format-form`, `billing-card`, `gdpr-card`) | Karten bleiben; `orderIdFormat` bezieht sich künftig auf `DocumentSequence(SALE)`. |

---

## 8. Tests, die benötigt werden

Aktuelle Test-Basis: **44 grün, alles reine Rechenlogik** (`tests/calculations.test.ts`, `tests/crypto.test.ts`). Für den Umbau brauchen wir zusätzlich:

- **Unit / Vitest**
  - `documentSequence.reserve` – atomarer Zähler, RLS-safe.
  - `inventory.movement` – Additions-/Subtraktionsinvarianten (`availableQty = originalQty − Σ OUT + Σ RETURN`).
  - `sales.createSale` – SaleLine/Allocation-Erzeugung + `InventoryMovement(OUT)`.
  - `returns.restock` – korrektes `InventoryMovement(RETURN)`, `ReturnAllocation`.
  - `consignment.balance` – Ableitung der vier Zähler aus Movements.
  - `debts.autoInsert` – bleibt inhaltsgleich, jetzt FK-basiert.
  - `import.dryRun` – Fehlerlisten pro Batch, keine echten Rows.
- **Integration**
  - End-to-End-Migration Backfill (Phase 2): identische Zahlen vor/nach in `loadDashboardKpis`, Plattform-Anteil, Top-Products, Debt-Saldo.
  - RLS-Test: neue Tabellen sind ohne `app.current_org_id` leer.
- **Playwright (Smoke)** – ein Verkauf mit 2 Positionen aus Lager + Konsignation, Retoure eine Position, Restock, Delete-Rollback.

---

## 9. Offene technische Fragen

1. **Multi-Einheit-Lots vs. Ein-Einheit-Zeilen:** Block 1 hat sich bewusst für
   „eine Zeile pro Einheit" entschieden (LagerIDs `L-{JJ}-{NNN}`). Sollen wir
   das beibehalten (Backfill → `lotSize=1`, LagerID = OwnedStockLot-Id) oder
   auf echte Mengen-Lots umstellen? Empfehlung: **beibehalten**, um bestehende
   Bulk-Semantik und Papier-Beleg-Anmutung nicht zu brechen; echte Multi-Lot
   erst wenn Bedarf entsteht.
2. **Debt-Refactor:** Ist es erwünscht, dass bestehende manuelle
   Freitext-Einträge migriert werden, oder bleiben sie als „SONSTIGES" ohne FK?
3. **Retoure-Modell:** Braucht eine `Return` zwingend `ReturnLine`s (auch bei
   Sales aus vor Phase 3), oder darf sie eine „legacy=true"-Retoure ohne Lines
   bleiben?
4. **Sale-Delete:** aktuell existiert `deleteSaleAction` (audit-log-Referenz).
   Wie mit `SaleLineAllocation`-referenzierten Positionen umgehen –
   „Movements zurückrollen" oder „Sale storniert markieren"?
5. **Export-Kompatibilität:** Sollen CSV/Excel-Exporte ihr aktuelles Format
   1:1 beibehalten (Roundtrip-Fähigkeit für Kunden)? Empfehlung: **ja**, das
   Exportformat definiert die Import-Aliasse und ist Nutzer-facing.
6. **Import-Batch-Rollback:** Wie tief? Nur die erzeugten Rows, oder auch
   ausgelöste Auto-Debts?
7. **Consignment-Provision:** `commissionPercent` vs. `agreedPayoutCents` – 
   soll der Auszahlungsbetrag Teil von `PurchaseLine` sein (Konsignation als
   Sonderfall des Einkaufs)?
8. **Menge=0 Storno:** heute setzt Storno den Bestand auf 0 & `status=CANCELLED`.
   Neu: `InventoryMovement(ADJUST, reason="CANCELLED")` – akzeptabel für den
   Dashboard-Bestand?
9. **Postgres-Version:** Nutzung von Generated Columns (`GENERATED ALWAYS AS
   (…) STORED`) für `availableQty`? Setzt Postgres 12+ voraus (haben wir).

---

## 10. Checkliste für die folgenden Phasen

- [x] **Phase 1** – Neues Prisma-Schema additiv + Migration + RLS +
      DocumentNumberService inkl. Tests. **Abgeschlossen** in Migration
      `20260706180000_inventory_datamodel_phase1` und
      [lib/services/document-number-service.ts](../lib/services/document-number-service.ts).
- [ ] **Phase 2** – Backfill-Skript als eigene Migration + Read-only-Verifier
      (`scripts/verify-backfill.ts`), der KPI/Bestand vor/nach vergleicht.
- [ ] **Phase 3** – Neue Actions `purchases.ts`, `inventory.ts`, `sales.v2.ts`,
      `returns.v2.ts`, `consignment.v2.ts`; dual write hinter Flag.
- [ ] **Phase 4** – UI-Umbau je Modul; jede Seite mit Vitest-Snapshot-Tests
      der Zahlen abgesichert.
- [ ] **Phase 5** – Feature-Flag on; Playwright-Smoke; Load-Test der neuen
      Aggregationen (`loadDashboardKpis` etc.).
- [ ] **Phase 6** – Alt-Spalten droppen, Rollback-Plan (git revert +
      DB-Backup) dokumentieren.
- [ ] **Phase 7** – `StockItem` / `SaleItem` / alte `ConsignmentInventory` als
      Read-only-Views oder final droppen; Export-Kompatibilität testen.

---

## 11. Analysierte Bereiche (Kurz-Liste)

`prisma/schema.prisma` · 7 Migrationen (`20260704000000_init` bis
`20260706170000_low_stock_threshold`) · Seed in `lib/actions/register.ts` ·
20 Server Actions unter `lib/actions/*.ts` · API Routes `app/api/auth/*`,
`app/api/stripe/webhook`, `app/api/export/[table]` · Services `lib/reporting.ts`,
`lib/calculations.ts`, `lib/activity.ts`, `lib/crypto.ts`, `lib/options.ts`,
`lib/import-export.ts`, `lib/billing.ts`, `lib/stripe.ts`, `lib/audit.ts`,
`lib/tenant-db.ts`, `lib/uploads.ts` · Zod-Schemas in allen Actions ·
Lagerformular `components/stock/stock-item-dialog.tsx`, Tabelle
`components/stock/stock-table.tsx`, Filter `stock-filter-bar.tsx` ·
Verkaufsformular `components/sales/sale-dialog.tsx`, Tabelle in
`app/(app)/verkauf/page.tsx`, Inline-Selects, Filter · Retourenmodul
`app/(app)/retouren/*` + `components/returns/*` · Konsignation
`app/(app)/konsignation/*` + `components/consignment/*` · Schulden
`app/(app)/schulden/*` + `components/debts/*` · Import/Export
`components/import-export/import-export-bar.tsx` + `lib/import-export.ts` +
`app/api/export/[table]/route.ts` + `lib/actions/import.ts` ·
Dashboard-Berechnungen `app/(app)/dashboard/page.tsx` + `lib/reporting.ts` +
`components/dashboard/*` · AuditLog `lib/audit.ts`, `lib/activity.ts`,
`components/reports/activity-widget.tsx` · Tests `tests/calculations.test.ts`,
`tests/crypto.test.ts`.

## 12. Bestätigung

**Es wurde keine Geschäftslogik verändert.** Diese Analyse enthält
ausschließlich Beobachtungen und einen Umbauplan. Es wurden **keine**
destruktiven Prisma-Änderungen und **keine** Daten-Migrationen ausgeführt.
Nur diese Datei (`docs/inventory-refactor-plan.md`) wird committet.
