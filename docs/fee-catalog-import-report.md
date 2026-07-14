# Importbericht Gebührenkataloge

Stand: 14.07.2026

## Quellen

- eBay Deutschland, [Gebühren für gewerbliche Verkäufer](https://www.ebay.de/help/selling/fees-credits-invoices/selling-fees?id=4809), abgerufen am 14.07.2026.
- Kaufland Global Marketplace, [Konditionen](https://www.kauflandglobalmarketplace.com/konditionen/), abgerufen am 14.07.2026.

Die beigefügte Prompt-Datei enthielt keinen separaten vollständigen eBay-Gebührenkatalog. Daher aktiviert StorageX nur den direkt aus der offiziellen Seite eindeutig normalisierten eBay-Teilbestand und kennzeichnet ausgeschlossene Ausnahmefamilien im Reviewbericht.

## Reproduzierbare Quelldateien

- `data/fee-catalogs/ebay-de-commercial-2026-07.json`
- `data/fee-catalogs/kaufland-de-2026-07.json`

Der SHA-256 wird über die normalisierten Fakten berechnet. Ein ADMIN importiert die Datei zunächst als DRAFT. Der Import validiert Identität, HTTPS-Quelle, Datumsfelder, eindeutige Kategorie-IDs und Basispunkte; anschließend entstehen `ImportBatch`, zeilenbezogene `SourceReference`, `FeeSchedule`, `FeeCategory` und `FeeRule`. Erst die getrennte Aktivierung archiviert eine alte aktive Version. Dabei wechseln passende Marktplatzkonten atomar auf die neue Standardversion. Referenzierte Versionen werden nicht gelöscht; ein aktiver Katalog kann deshalb nicht direkt archiviert werden.

## eBay.de 2026-07

- 17 aktive Gebührenkategorien aus sechs offiziellen Bereichen.
- 265 generierte Regeln über Shopmodelle und belegte Zustandsvarianten.
- Kategorie-IDs und Originalbezeichnungen bleiben erhalten.
- Fixanteil: 0,35 Euro bis einschließlich 10 Euro, 0,45 Euro darüber.
- Gebührenbasis: Gesamtbetrag einschließlich Käufer-Versand.
- Angebotsgebühren: kein Shop 0,35 Euro, Basis 0,10 Euro, Top 0,05 Euro, Premium/Platin 0 Euro bei ausdrücklicher Berücksichtigung.
- Platin: 10 Prozent Rabatt auf variable und fixe Verkaufsprovision.
- Zustandsregel: 5 Prozent nur in Kategorien, für welche die Quelle sie ausdrücklich ausweist.
- Staffelregeln werden marginal abgebildet, beispielsweise 12 Prozent bis 990 Euro und 3 Prozent darüber.

REVIEW_REQUIRED beziehungsweise bewusst nicht aktiv: Sneaker-100-Euro-Fall, komplexe Uhren-/Schmuck-Shopstaffeln, zahlreiche Auto-/Motorrad-Ausnahmen und automatische Ziellandzuordnung internationaler Gebühren. Niedriger Servicestatus und private Verkäufer besitzen keine aktive Regel.

## Kaufland.de 2026-07

- 13 veröffentlichte Gebührenbereiche und 13 aktive Regeln.
- 7 bis 16 Prozent Provision auf Bruttoverkaufspreis inklusive Versand.
- Medien: 13 Prozent plus 0,70 Euro pro Artikel.
- Gebühren-USt wird separat gerechnet.
- Basic 39,95 Euro netto/Monat und Plus 59,95 Euro netto/Monat sind Account-/Ausgabendaten ohne Stückumlage.
- Andere Länder bleiben im Modell möglich, aber deaktiviert, bis eine eigene offizielle, getestete Version vorliegt.

## Review- und Versionsprozess

Neue Quelle abrufen, Fakten normalisieren, neue Datei/Version erstellen, importieren, DRAFT-Differenz und Testrechnungen prüfen, unklare Regeln auf REVIEW_REQUIRED lassen, anschließend aktivieren. Die Verwaltung zeigt Kategorien-/Regelanzahl und deren Delta zur aktiven Version sowie die Kategorien und Einzelregeln der aktiven Version. Fachliche Detailunterschiede bleiben Teil des Importreports und der Quelldatei. Eine Aktivierung markiert abhängige Produktkalkulationen als veraltet und bietet eine ausdrücklich ausgelöste Neuberechnung an. Live-Scraping pro Kalkulation findet nicht statt.
