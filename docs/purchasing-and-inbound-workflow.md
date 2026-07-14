# StorageX Purchasing and Inbound Workflow

Stand: 14. Juli 2026
Phase: Prompt 4 – Einkauf, Lieferanten und Wareneingang

## Ergebnis und Grenzen

StorageX trennt Beschaffung und tatsächlichen Bestand, ohne den bestehenden Kern zu ersetzen:

```text
Product
  -> Purchase -> PurchaseLine
       -> PurchaseReceipt -> PurchaseReceiptLine
            -> InventoryPosition(OWNED) -> OwnedStockLot
                 -> InventoryMovement(PURCHASE_RECEIPT)
```

`/einkauf` beantwortet Bestell-, Versand-, Eingangs-, Frist- und Finanzfragen. `/lager` zeigt weiterhin den tatsächlichen aktuellen und Legacy-Bestand. Der bestehende Sofortzugang über den Lagerdialog bleibt verfügbar; `createOwnedPurchase` ist jetzt der Kompatibilitätsadapter, der Bestellung und bestätigten Eingang in derselben Transaktion erzeugt.

Diese Phase implementiert keine automatische Lieferantenretoure. Die bestehende separate `SupplierReturn`-Grundlage bleibt der spätere, explizit bestätigte Folgeschritt.

## Additives Datenmodell

### Purchase

Bestehende Pflichtfelder und Snapshots bleiben unverändert. Additiv hinzugekommen sind Lieferanten-Bestellnummer, erwartetes und vollständiges tatsächliches Eingangsdatum, Versanddienstleister, Trackingnummer, Versandstatus, gespeicherte Rückgabefrist, optionale Dokumentreferenz sowie `ORDERED`, `PARTIALLY_RECEIVED` und `RECEIVED`.

`businessPartnerId` und `paymentAccountId` referenzieren die Prompt-1-Stammdaten. `vendor` und `paymentMethod` bleiben lesbare Beleg-Snapshots und Freitext-Fallbacks.

### PurchaseReceipt und PurchaseReceiptLine

Ein Receipt ist ein bestätigtes Eingangsereignis mit Datum, Versand-/Belegreferenz, Notiz und Ersteller. Jede Receipt-Line referenziert eine PurchaseLine, eine neu erzeugte InventoryPosition mit OwnedStockLot und das zugehörige `PURCHASE_RECEIPT`-Movement. Sie speichert Menge, zentralen Artikelzustand, optionalen Legacyzustand, Prüfstatus und Rückgabefrist.

Mehrere Teilzugänge derselben PurchaseLine erzeugen mehrere getrennte Lots. Dadurch bleiben Eingangsdatum, Kosten, Zustand, Prüfung und Frist je Charge nachvollziehbar.

Beide neuen Tabellen besitzen `organization_id`, verpflichtendes und erzwungenes RLS, Tenant-/Bypass-Policies, Foreign Keys und positive Mengenchecks. Die Migration entfernt oder befüllt keine Legacyspalte.

## Service-Seam und Invarianten

`lib/services/owned-purchase-service.ts` stellt drei fachliche Interfaces bereit:

1. `createPurchaseOrder`: erzeugt Purchase/PurchaseLines, Dokumentnummer, Audit und gegebenenfalls genau eine relationale Purchase-Schuld – noch ohne Bestand.
2. `receivePurchase`: validiert offene Mengen tenant-gescoppt, erzeugt Receipt, je Eingangszeile Position/Lot/Movement und aktualisiert abgeleitete Bestell-/Versandzustände.
3. `createOwnedPurchase`: direkter Sofortzugang als kompatibler transaktionaler Adapter.

Verbindliche Invarianten:

- Eingangsmenge ist positiv und überschreitet nie die offene Bestellmenge.
- Eine Eingangszeile gehört zur genannten Purchase und Organisation.
- Jeder bestätigte Eingangs-Slice erzeugt genau ein Lot und ein Movement.
- `PURCHASE_RECEIPT` bucht je Prüfergebnis nach `AVAILABLE`, `INSPECTION` oder `DEFECTIVE`; Mengenfelder werden ausschließlich im Inventory-Service verändert.
- Vollständig eingegangen bedeutet: Summe aller Receipt-Lines entspricht für jede PurchaseLine der Bestellmenge.
- Stornierte Einkäufe erhalten keinen Eingang.
- Ein privates konfiguriertes Zahlungskonto kann seinen BusinessPartner als Schuldgläubiger liefern; die alte Namensauflösung bleibt nur als Legacy-Fallback.
- Fristen erzeugen keine Rückgabe und keine Bestandsbewegung.

## Operative Ansichten

### Einkauf

- `Standard`: offene und aktuelle Beschaffung;
- `Offen`: Draft, bestätigt, bestellt oder teilweise eingegangen;
- `Unterwegs`: versandbereit, versandt oder teilweise eingegangen;
- `Eingetroffen`: vollständig eingegangene Einkäufe;
- `Rückgabefristen`: alle nicht stornierten Einkäufe mit gespeicherter Frist, einschließlich überfälliger;
- `Finanzen`: Zahlungs- oder Debt-Bezug;
- `Alle`: keine Statusprojektion.

Standardspalten folgen der Table View Matrix: Einkaufsnummer, Bestelldatum, Lieferant, Bestell- und Versandstatus, Position/Fortschritt, Brutto/Netto und Zahlungskonto. Lieferanten-Bestellnummer, erwartetes/tatsächliches Datum, Rückgabefrist, Tracking, Steuer, Debt, Dokument und Notiz sind schaltbar beziehungsweise im Drawer sichtbar. Suche, Sortierung, kombinierte Filter, URL-Zustand, Auswahl, Spalten/Dichte, gespeicherte Ansichten, Pagination, Detail-Drawer und gefilterter Export verwenden den Prompt-3-Table-Seam.

### Lager

Die bestehenden aktuellen und Legacy-Projektionen bleiben erhalten. Additive Presets sind `Standard`, `Bestand`, `Einkauf`, `Listings`, `Prüfung/Defekt` und `Alle`. Die Beschaffungstabelle wird nicht in `/lager` dupliziert.

## Fristen und Dashboard

Rückgabefristen werden auf Purchase und Receipt-Line gespeichert. Die Einkaufsansicht klassifiziert sie zusätzlich zur Farbe als `aktiv`, `bald fällig` oder `abgelaufen`. Das Dashboard zeigt bis zu fünf nicht stornierte Einkäufe mit überfälliger oder binnen 14 Tagen erreichter Frist und verlinkt auf die gefilterte Einkaufsansicht. Der Hinweis nennt ausdrücklich „Einkauf prüfen“ und führt keine Rückgabe automatisch aus.

## Import und Export

Die bestehende Importengine wurde um `einkauf` und `wareneingang` erweitert. Beide bieten leere und Beispielvorlagen als CSV/XLSX mit Pflichtfeldern, Formaten und Spaltenbeschreibung. Minimal akzeptiert werden Datum, Lieferant, Artikel, Menge und Preis.

Ein Einkaufsimport erzeugt eine Bestellung ohne Bestand. Gleiche optionale Lieferanten-Bestellnummern gruppieren mehrere Zeilen zu einer mehrzeiligen Purchase. Ein Wareneingangsimport mit StorageX-Einkaufsnummer bucht gegen eine eindeutig offene PurchaseLine; ohne Einkaufsnummer läuft er als direkter Zugang. Syntax-, Mengen-, Preis-, Zustands- und Fristfehler werden im Dry Run zeilenbezogen angezeigt. Commit, ImportBatch, SourceReference, Audit, Row-Hash und bestehende Konflikt-/Review-Sperren bleiben unverändert. Exporte berücksichtigen die aktiven Einkaufsfilter; Wareneingänge werden als Receipt-Line-Projektion exportiert.

## Verifikation

Automatisierte Abdeckung umfasst direkten Zugang, Teil-/Vollzugang, wiederholte Lot-Slices, Überlieferungsschutz, Fristen, `PURCHASE_RECEIPT`-Buckets, Debt-Idempotenz und konfigurierten privaten Gläubiger, RLS/Foreign Keys/Mengenchecks, Einkaufs-/Lageransichten sowie Vorlagen und Dry-Run-Fehler.

Abschlussstand vom 14. Juli 2026:

- `prisma validate` und `prisma generate`: erfolgreich;
- TypeScript und ESLint: erfolgreich, ohne Fehler oder Warnungen;
- Vitest: 33 Dateien und 235 Tests erfolgreich;
- `integrity:check`: 13 von 13 Invarianten erfolgreich;
- Production Build: erfolgreich, einschließlich der dynamischen Route `/einkauf`;
- `git diff --check`: erfolgreich.

Die additive Migration wird mit dem Repository ausgeliefert, aber nicht automatisch auf eine externe Datenbank angewandt. Die konfigurierte QA-Datenbank blieb in dieser Phase unverändert, weil für den neuen externen Schema-Deploy eine separate ausdrückliche Freigabe erforderlich ist. Entsprechend wurde kein datenbankgestützter Browserlauf gegen die neue Route als bestanden ausgegeben; UI-Verhalten und Query-Projektionen sind durch Komponenten-/Konfigurationstests, TypeScript und den Production Build abgesichert.
