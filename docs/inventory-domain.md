# Inventory Domain

## Ziel

Bestandsmengen der neuen Inventory-Struktur werden ausschließlich über den zentralen Service `lib/services/inventory-service.ts` verändert. Jede Änderung läuft in einer Datenbanktransaktion, prüft den aktuellen Bestand, schreibt eine `InventoryMovement`-Historie und erzeugt einen AuditLog-Eintrag.

Legacy-Modelle wie `StockItem`, `SaleItem` und `ConsignmentInventory` bleiben vorerst unverändert. Diese Domain beschreibt nur `InventoryPosition`, `OwnedStockLot`, `ConsignmentLot` und `InventoryMovement`.

## Buckets

- `AVAILABLE`: verkaufbarer Bestand.
- `RESERVED`: reservierter Bestand, der noch nicht verkauft wurde.
- `INSPECTION`: physisch vorhanden, aber noch in Prüfung.
- `DEFECTIVE`: physisch vorhanden, aber nicht verkaufbar.
- `null` als Quelle: Zugang von außerhalb des Bestandssystems.
- `null` als Ziel: Abgang aus dem Bestandssystem.

## Mengenfelder

- `quantityReceived`: kumulierter Brutto-Zugang von außen, z. B. Einkauf, Konsignation, Retoureingang oder manuelle Zugangskorrektur.
- `quantityAvailable`: aktuell verkaufbare Menge.
- `quantityReserved`: aktuell reservierte Menge.
- `quantityInspection`: aktuell in Prüfung befindliche Menge.
- `quantityDefective`: aktuell defekte/nicht verkaufbare Menge.
- `quantitySold`: aktuell netto verkaufte, noch nicht physisch zurückgeführte Menge.

`quantitySold` steigt bei `SALE_OUT`. Es sinkt bei `RETURN_RECEIPT`, weil die Ware ab physischem Retoureingang nicht mehr als netto verkauft gilt. Danach verschiebt `RETURN_RESTOCK` die Menge nur noch von `INSPECTION` nach `AVAILABLE`; `RETURN_DEFECTIVE` verschiebt sie von `INSPECTION` nach `DEFECTIVE`.

Beispiel:

1. `PURCHASE_RECEIPT` +10: `available=10`, `sold=0`
2. `SALE_OUT` -3: `available=7`, `sold=3`
3. `RETURN_RECEIPT` +2 in Prüfung: `inspection=2`, `sold=1`
4. `RETURN_RESTOCK` +1: `available=8`, `inspection=1`
5. `RETURN_DEFECTIVE` +1: `defective=1`, `inspection=0`, `sold=1`

## Movement Types

- `PURCHASE_RECEIPT`: `null -> AVAILABLE`, eigener Wareneingang.
- `CONSIGNMENT_RECEIPT`: `null -> AVAILABLE`, Konsignationszugang.
- `SALE_OUT`: `AVAILABLE -> null`, Verkauf.
- `RESERVE`: `AVAILABLE -> RESERVED`, Reservierung.
- `RELEASE_RESERVATION`: `RESERVED -> AVAILABLE`, Reservierung aufheben.
- `RETURN_RECEIPT`: `null -> INSPECTION`, physisch eingegangene Retoure.
- `RETURN_RESTOCK`: `INSPECTION -> AVAILABLE`, Retoure wieder verkaufbar.
- `RETURN_DEFECTIVE`: `INSPECTION -> DEFECTIVE`, Retoure defekt.
- `ADJUSTMENT_IN`: `null -> bucket`, manuelle Zugangskorrektur.
- `ADJUSTMENT_OUT`: `bucket -> null`, manuelle Abgangskorrektur.
- `REVERSAL`: Gegenbewegung zu einer bestehenden Movement-Zeile.

## Invarianten

- `quantity` einer Movement-Zeile ist immer positiv.
- Alle Mengenfelder auf `InventoryPosition` dürfen nie negativ werden.
- Eine Bewegung darf keine größere Menge aus einem Bucket entnehmen, als dort verfügbar ist.
- `RETURN_RECEIPT` darf `quantitySold` nicht unter 0 senken.
- Idempotente Requests mit identischem `organizationId + idempotencyKey` werden nicht doppelt angewendet.
- Wird derselbe `idempotencyKey` für eine abweichende Bewegung verwendet, schlägt der Service mit `IDEMPOTENCY_KEY_CONFLICT` fehl.
- Fremde Organisationen können Positionen nicht verändern, weil jede Operation `organizationId + inventoryPositionId` prüft und in der DB mit RLS-Kontext läuft.

## Transaktionsgrenze

Der Service führt in einer Transaktion aus:

1. RLS-Kontext setzen.
2. Idempotenz prüfen.
3. `InventoryPosition` mandantensicher laden.
4. Mengeninvarianten berechnen.
5. Atomisches `updateMany` mit `gte`-Guards ausführen.
6. `InventoryMovement` schreiben.
7. `AuditLog` schreiben.

Scheitert ein Schritt nach der Mengenänderung, rollt die Transaktion die Mengenänderung und die Movement-Zeile zurück.

## Timeline

`getInventoryTimeline({ organizationId, inventoryPositionId })` liefert die chronologische Movement-Historie einer Position. Die Funktion prüft zuerst, dass die Position zur Organisation gehört, und liest dann die Bewegungen sortiert nach `createdAt` und `id`.

## Eigener Wareneingang ab Phase 3

Neue eigene Lagerzugänge werden nicht mehr als einzelne `StockItem`-Zeilen geschrieben. Der neue Pfad ist:

`Product -> Purchase -> PurchaseLine -> InventoryPosition(OWNED) -> OwnedStockLot -> InventoryMovement(PURCHASE_RECEIPT)`

Für 10 gleiche Artikel entsteht genau eine fachliche Einkaufsposition und eine Charge:

- ein `Purchase` mit `purchaseNumber` im Format `E-YY-NNNN`,
- eine `PurchaseLine` mit `quantity=10`,
- eine `InventoryPosition` mit `inventoryNumber` im Format `L-YY-NNNN`,
- ein `OwnedStockLot` mit Einkaufsdaten, VST, Status und Bildern,
- eine `PURCHASE_RECEIPT`-Bewegung mit `quantity=10`.

Unterschiedliche Einkaufspreise, andere Händler oder mehrere fachliche Positionen bleiben getrennte `PurchaseLine`-/Lot-Kombinationen. Alte `StockItem`-Daten bleiben für Übergang, Export und spätere Migration erhalten, werden bei neuen Wareneingängen aber nicht mehr parallel erzeugt.

## Konsignationsbestand ab Phase 4

Neue Konsignationszugänge bleiben fachlich im separaten Modul `/konsignation`,
werden technisch aber über dieselbe Inventory-Domain geführt:

`Product -> InventoryPosition(CONSIGNMENT) -> ConsignmentLot -> InventoryMovement(CONSIGNMENT_RECEIPT)`

Für einen Pattfield-Zugang mit 20 Stück entsteht:

- ein `Product` aus Name, Variante, EAN und Kategorie oder ein bestehender Produktbezug,
- eine `InventoryPosition` mit `inventoryType=CONSIGNMENT` und K-Nummer im Format `K-YY-NNNN`,
- ein `ConsignmentLot` mit Partnerfirma, externer SKU, Identifikationsnummer, EK, Endbetrag, Versand, realer OVP, Channel-Preisen und Kommentar,
- eine `CONSIGNMENT_RECEIPT`-Bewegung mit der erhaltenen Menge.

Pattfield ist nur ein Datenwert in `partnerCompany`, kein hartcodierter Spezialfall.
Weitere Konsignationspartner nutzen dieselbe Struktur. Legacy-Daten in
`ConsignmentInventory` bleiben lesbar und bearbeitbar, neue Einträge werden aber
nicht mehr parallel in die Legacy-Tabelle geschrieben.

Bestandsänderungen neuer Konsignationsware laufen ausschließlich über
`lib/services/inventory-service.ts`:

- Verkaufsvorbereitung oder manueller Abgang: `SALE_OUT` (`AVAILABLE -> null`).
- Physische Retoure: `RETURN_RECEIPT` (`null -> INSPECTION`) und Reduktion von `quantitySold`.
- Defektmarkierung: `RETURN_DEFECTIVE` (`INSPECTION -> DEFECTIVE`).

Damit ist Konsignationsware getrennt sichtbar, aber später über dieselbe
Verkaufs- und Retourenlogik wie eigener Bestand verwendbar.

## Verkauf ab Phase 5

Neue Verkäufe schreiben keine direkten `StockItem`- oder
`ConsignmentInventory`-Bestandsänderungen mehr. Der neue Pfad ist:

`Sale(orderNumber=V-YY-NNNN) -> SaleLine -> SaleLineAllocation -> InventoryMovement(SALE_OUT)`

`Sale.orderNumber` bleibt aus Kompatibilitätsgründen das bestehende Feld für die
sichtbare Verkaufsnummer; fachlich enthält es jetzt die V-Nummer aus
`DocumentSequence(SALE)`.

- `SaleLine` speichert Produkt-Snapshots (`descriptionSnapshot`,
  `variantSnapshot`, `sizeSnapshot`), damit spätere Produktänderungen alte
  Verkaufsbelege nicht verfälschen.
- `SaleLineAllocation` ist die echte Verbindung zum Bestand. Sie speichert
  `inventoryPositionId`, Menge, `inventoryTypeSnapshot` und
  `unitCostNetSnapshot`.
- Eigenbestand wird standardmäßig FIFO über verfügbare `OWNED`-Positionen
  desselben Produkts allokiert.
- Konsignationsbestand wird nur aus der eindeutig gewählten K-Position
  allokiert; verschiedene Partner werden nicht automatisch gemischt.
- Der Wareneinsatz und damit Marge/Gewinn basieren auf den Cost-Snapshots der
  Allocations, nicht auf aktuellen Produkt- oder Lot-Werten.
- Storno neuer Verkäufe läuft über `REVERSAL` der zugehörigen
  `SALE_OUT`-Movements und ist über Idempotency-Keys doppelsicher.

Legacy-Verkäufe mit `SaleItem` bleiben lesbar. Sie werden nicht destruktiv
migriert und können nicht automatisch über den neuen Reversal-Pfad storniert
werden.

## Retouren ab Phase 6

Neue Retouren werden relational und mengenbasiert erfasst:

`Return(returnNumber=R-YY-NNNN) -> ReturnLine -> ReturnAllocation -> SaleLineAllocation -> InventoryPosition`

Der Nutzer wählt keinen Lager-/Order-Freitext mehr, sondern einen Verkauf und
dessen retournierbare Positionen. `ReturnAllocation` verweist auf die
ursprüngliche `SaleLineAllocation`; dadurch ist bekannt, aus welcher L- oder
K-Position die Ware ursprünglich verkauft wurde.

- `ReturnLine.quantity` beschreibt die retournierte Menge je Verkaufsposition.
- `ReturnAllocation.quantity` darf die verkaufte und noch nicht retournierte
  Menge der ursprünglichen Allocation nicht überschreiten.
- `REQUESTED` / „Angekündigt“ erzeugt keine Bestandsbewegung.
- Physischer Eingang bucht `RETURN_RECEIPT` (`null -> INSPECTION`).
- Verkaufbare Retoure bucht danach `RETURN_RESTOCK` (`INSPECTION -> AVAILABLE`).
- Defekte Retoure bucht danach `RETURN_DEFECTIVE` (`INSPECTION -> DEFECTIVE`).
- Wiederholte Workflow-Aktionen sind über gespeicherte Movement-IDs und
  Idempotency-Keys doppelsicher.

Legacy-Retouren ohne `ReturnLine` bleiben in `/retouren` lesbar und editierbar,
werden aber nicht automatisch über den neuen Movement-Workflow gebucht.

## Schulden ab Phase 7

Neue Schulden erhalten eine eigene SaaS-Nummer aus `DocumentSequence(DEBT)`:

`Debt(debtNumber=SCH-YY-NNNN)`

Die alte `refId` bleibt nur für importierte Legacy-Daten und manuelle Hinweise
erhalten. Neue automatische Schulden werden technisch relational verknüpft:

- Einkaufs-Schulden: `Debt -> DebtPurchaseLink -> Purchase`
- Verkaufs-Schulden: `Debt -> DebtSaleLink -> Sale`
- Historische oder ergänzende Bestandsbezüge: `Debt -> DebtInventoryLink -> InventoryPosition`

`Debt.type` unterscheidet die fachliche Herkunft:

- `PURCHASE`: Einkauf wurde privat durch Richard oder Daniel bezahlt.
- `SALE`: Verkaufserlös wurde an ein privates Konto von Richard oder Daniel ausgezahlt.
- `MANUAL`: manuell angelegte Schuld ohne Ursprungsrelation.
- `OTHER`: reserviert für spätere Sonderfälle.

Kauf-Automatismus:

- Nur `paymentMethod = Richard` oder `paymentMethod = Daniel` erzeugt eine
  automatische Schuld.
- Schuldner ist `GbR`, Empfänger ist die private Person.
- Betrag ist die Bruttosumme des gesamten `Purchase`.
- Ein Einkauf mit mehreren `PurchaseLine`s erzeugt genau eine Schuld.
- `DebtPurchaseLink.purchaseId` ist eindeutig und macht wiederholte Aufrufe
  idempotent.

Verkaufs-Automatismus:

- Private Auszahlungsempfänger werden aktuell aus den vorhandenen Namen/Aliassen
  abgeleitet (`Richard`, `Daniel`, `... R`, `... D`).
- Schuldner ist die private Person, Empfänger ist `GbR`.
- Die Betragsbasis bleibt wie im Bestandssystem: `Sale.salePriceCents`
  beziehungsweise VK brutto.
- `DebtSaleLink.saleId` ist eindeutig und verhindert doppelte Schulden pro
  Verkauf.

Beim Wechsel auf `SETTLED` setzt der zentrale Debt-Service `settledAt` und
`paidCents`, schreibt AuditLog und verändert den zugrunde liegenden Einkauf
oder Verkauf nicht.

## Import ab Phase 8

Der Import ist eine nachvollziehbare Migrationspipeline statt eines direkten
Legacy-Tabellen-Inserts.

- Jeder finale Import schreibt einen `ImportBatch` mit Dateiname, Datei-Hash,
  Importtyp, Status, Zeitstempeln, User und Zusammenfassung.
- Jede erzeugte Zielentity erhält eine `SourceReference` mit Sheetname,
  Zeilennummer, Row-Hash, Zielentity, Ziel-ID, Legacy-Referenz, Status,
  Warnungen und Fehlern.
- Row-Hashes und SourceReferences verhindern stille Doppelimporte. Bereits
  bekannte Zeilen werden im Dry Run als `UNCHANGED` gemeldet.
- Lagerzeilen werden nur gruppiert, wenn Produkt, Variante, Größe, EAN,
  Händler, Kaufdatum, EK, VST, Zahlungsmethode und Statusinformationen
  identisch sind. Alle alten LagerIDs bleiben als Legacy-Referenzen auf die
  neue `InventoryPosition` abbildbar.
- Verkäufe erhalten neue V-Nummern. Wenn Legacy-LagerIDs eindeutig auf
  importierte `InventoryPosition`s zeigen, entstehen `SaleLineAllocation`s;
  sonst wird der Verkauf als historisch `UNRESOLVED` importiert.
- Pattfield/Konsignation nutzt robuste Header-Erkennung und schreibt neue
  K-Positionen über die gemeinsame `InventoryPosition(CONSIGNMENT)`-Struktur.
- Schuldenreferenzen unterstützen Einzelwerte, `&`, Bindestrichbereiche,
  `bis`, Zeilenumbrüche und Leerzeichenvarianten. Gesamtbeträge werden bei
  Mehrfachreferenzen nicht vervielfacht.
## Abschlussintegration ab Phase 10

Die neue relationale Architektur ist fachlich führend. Neue Kernprozesse laufen
über:

- Einkauf: `Purchase -> PurchaseLine -> InventoryPosition(OWNED) -> OwnedStockLot -> PURCHASE_RECEIPT`.
- Konsignation: `InventoryPosition(CONSIGNMENT) -> ConsignmentLot -> CONSIGNMENT_RECEIPT`.
- Verkauf: `Sale -> SaleLine -> SaleLineAllocation -> SALE_OUT`.
- Retoure: `Return -> ReturnLine -> ReturnAllocation -> RETURN_RECEIPT/RETURN_RESTOCK/RETURN_DEFECTIVE`.
- Schulden: `Debt -> DebtPurchaseLink` beziehungsweise `DebtSaleLink`.

Legacy-Modelle (`StockItem`, `SaleItem`, `ConsignmentInventory`, `Debt.refId`)
werden nicht destruktiv entfernt, solange historische Anzeige, Export,
Import-Review oder Dashboard-Fallbacks darauf zugreifen.
