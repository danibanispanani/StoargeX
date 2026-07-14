# Marktplatz-Kategoriezuordnung

`Product.category` bleibt die interne, plattformunabhängige StorageX-Kategorie. Gebührenkategorien liegen versioniert in `FeeCategory` und werden je Produkt/Marktplatz über `ProductMarketplaceMapping` referenziert.

Status: `UNASSIGNED`, `SUGGESTED`, `CONFIRMED`, `REVIEW_REQUIRED`. Prompt 5 erzeugt keine Titelklassifikation und keine automatische finale Zuordnung. Produktanlage/-bearbeitung sowie die sichere Bulk-Aktion setzen eine vom Nutzer gewählte aktive Kategorie auf `CONFIRMED`; eBay und Kaufland bleiben getrennt. Ein Wechsel markiert bestehende Kalkulationen als veraltet.

eBay zeigt offizielle Bezeichnung, Kategorie-ID und übergeordneten Gebührenbereich. Kaufland zeigt die offizielle Gebührengruppe. Ein interner Mapping-Vorschlag kann später ergänzt werden, darf aber ohne Nutzerbestätigung nicht zu `CONFIRMED` werden.

Für einen späteren Dateiimport sind Produkt-ID oder EAN, eBay-Kategorie-ID, Kaufland-Gebührengruppe und Zustand vorgesehen. Unbekannte Produkte/Kategorien müssen `REVIEW_REQUIRED` liefern; sie dürfen weder Produkte noch Kategorien automatisch anlegen.
