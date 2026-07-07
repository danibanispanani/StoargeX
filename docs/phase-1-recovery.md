# Phase 1 Recovery

## Ausgangszustand

- Arbeitsbaum beim Recovery-Audit: sauber, keine uncommitteten Dateien.
- Letzter relevanter Commit: `2345a27 Phase 1: additive inventory data model + DocumentNumberService`.
- Phase 0 ist dokumentiert in `docs/inventory-refactor-plan.md`.
- Phase 1 wurde bereits begonnen und teilweise committed.

## Bereits vollständig umgesetzt

- Product: bestehendes `Product`-Modell wurde wiederverwendet und additiv um `size` erweitert; keine doppelte Produkttabelle gefunden.
- DocumentSequence: Modell `DocumentSequence`, Enum `DocumentKind`, eindeutige Sequenz je Organization/Jahr/Dokumentart und zentraler Service `lib/services/document-number-service.ts` vorhanden.
- PurchaseLine: Modell vorhanden, mit Organization-, Purchase- und Product-Bezug, Decimal-Geldbeträgen und gespeicherten Summenfeldern.
- InventoryPosition: Modell vorhanden, mit `InventoryType`, sichtbarer `inventoryNumber`, Mengenfeldern und Unique Constraint je Organization + Nummer.
- OwnedStockLot: Modell vorhanden, eindeutige Relation zur InventoryPosition, Einkaufspreise, VST, Zahlungsmethode, Entry-Status und Legacy-Referenz vorhanden.
- ConsignmentLot: Modell vorhanden, eindeutige Relation zur InventoryPosition, `partnerCompany` frei als Text, externe SKU, Identifikationsnummer, finanzielle Felder und Channel-Preise vorhanden.
- Tests: Unit-Tests für Formatierung, erste Nummer, Folgenummer, getrennte Organizations, getrennte Dokumenttypen, Jahreswechsel und simulierte parallele Erzeugung vorhanden.

## Teilweise umgesetzt

- Purchase: Modell und `createdById` waren vorhanden, aber die Relation/FK zu `User` fehlte.
- Migration: additive Phase-1-Migration vorhanden, aber ohne Foreign Key für `purchases.created_by_id`.
- Dokumentation: `docs/inventory-refactor-plan.md` enthielt gleichzeitig „Phase 1 abgeschlossen“ und alte Analyse-Formulierungen; das ist inkonsistent.

## Fehlerhaft oder inkonsistent

- `Purchase.createdById` war nur ein String-Feld ohne Prisma-Relation und ohne DB-FK.
- Das Plan-Dokument nannte in der alten Migrationsreihenfolge noch Phase-1-Objekte, die laut aktuellem Recovery-Prompt ausdrücklich nicht zu Phase 1 gehören.

## Noch nicht umgesetzt

- Additive Folgemigration für die fehlende Purchase-createdBy-Relation.
- Schema-Ergänzung um `Purchase.createdBy` und `User.createdPurchases`.
- Dokumentationsbereinigung des Phase-1-Status.
- Abschließende Validierung mit Prisma, TypeScript, Lint, Tests und Production Build.

## Gefundene uncommittete Änderungen

- Keine.

## Gefundene Migrationen

- `20260704000000_init`
- `20260704132126_trade_core`
- `20260704150000_returns_consignment_debts_tasks`
- `20260705090000_theme_and_billing`
- `20260706100000_rework_stock_sales_products`
- `20260706150000_returns_debts_tasks_block2`
- `20260706170000_low_stock_threshold`
- `20260706180000_inventory_datamodel_phase1`

## Geplanter Abschluss dieser Phase

- Purchase-createdBy-Relation additiv ergänzen.
- Sichere Folgemigration erzeugen, statt die bereits committed Phase-1-Migration umzuschreiben.
- `docs/inventory-refactor-plan.md` auf den tatsächlichen Phase-1-Scope bereinigen.
- Validierungsbefehle ausführen und Ergebnisse dokumentieren.

## Ergebnis

### Übernommene Änderungen der vorherigen Agent-Session

- Additives Prisma-Datenmodell mit `DocumentSequence`, `Purchase`, `PurchaseLine`, `InventoryPosition`, `OwnedStockLot` und `ConsignmentLot`.
- Wiederverwendung von `Product` inklusive additivem Feld `size`.
- Migration `20260706180000_inventory_datamodel_phase1` mit neuen Tabellen, Enums, Indizes, RLS-Policies und Mengen-Constraints.
- Zentraler `DocumentNumberService` unter `lib/services/document-number-service.ts`.
- Unit-Tests für Dokumentnummern unter `tests/document-number-service.test.ts`.

### Von mir reparierte Änderungen

- `Purchase.createdById` hat jetzt eine Prisma-Relation zu `User`.
- `User` hat die inverse Relation `createdPurchases`.
- Die fehlende DB-FK-Absicherung wurde additiv ergänzt.
- `docs/inventory-refactor-plan.md` wurde von widersprüchlichen Analyse-/Abschlussaussagen bereinigt.
- Ein fehlgeschlagener Migrationsversuch durch UTF-8-BOM in der neuen SQL-Datei wurde mit `prisma migrate resolve --rolled-back` bereinigt; danach wurde die reparierte Migration erfolgreich angewendet.

### Neu implementierte Teile

- Neue Migration `20260707120000_inventory_phase1_purchase_created_by_fk`.
- Recovery-Dokumentation in dieser Datei.

### Migrationen

- `20260706180000_inventory_datamodel_phase1`: vorhandene additive Phase-1-Migration.
- `20260707120000_inventory_phase1_purchase_created_by_fk`: additive Recovery-Migration für `purchases.created_by_id -> users.id`.
- `npx prisma migrate deploy`: erfolgreich angewendet.
- `npx prisma migrate status`: Datenbank ist aktuell.

### Tests

- `npx prisma format`: erfolgreich.
- `npx prisma validate`: erfolgreich.
- `npx prisma generate`: erfolgreich.
- `npx prisma migrate status`: erfolgreich nach Deployment.
- `npx tsc --noEmit`: erfolgreich.
- `npm run lint`: erfolgreich.
- `npm test`: erfolgreich, 3 Testdateien / 55 Tests.
- `npm run build`: erster Lauf scheiterte nur wegen blockiertem Google-Fonts-Netzwerk; Wiederholung mit Netzwerkfreigabe erfolgreich.

### Bekannte Restpunkte

- Phase 2: Backfill/Verifier für bestehende Legacy-Daten.
- Phase 3+: Dual-Write-Actions, UI-Umbau, Import-/Retouren-/Verkaufsumbau und späteres Entfernen von Legacy-Strukturen.
