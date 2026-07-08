# Import Migration

## Ziel

Die Google-Sheet-/Excel-Daten sind Importquelle. Das SaaS erzeugt neue
Dokumentnummern (`L`, `K`, `E`, `V`, `R`, `SCH`) und speichert alte IDs nur als
Legacy-Referenz über `SourceReference`.

## Pipeline

- `ImportBatch` dokumentiert Datei, Hash, Importtyp, Status, Start/Ende, User
  und Zusammenfassung.
- `SourceReference` dokumentiert Sheet, Zeile, Row-Hash, Zielentity,
  Zielentity-ID, Legacy-Referenz, Warnungen und Fehler.
- Dry Runs schreiben keine Produktivdaten, liefern aber Gruppierungen,
  Konflikte und erwartete Zielobjekte.
- Row-Hashes verhindern stille Doppelimporte.

## Fachliche Regeln

- Lagerzeilen werden nur gruppiert, wenn Produkt, Variante, Größe, EAN,
  Händler, Kaufdatum, EK, VST, Zahlungsmethode und Status gleich sind.
- Verkäufe 2026 werden relational verknüpft, wenn Legacy-LagerIDs eindeutig
  auf `InventoryPosition`s zeigen.
- Verkäufe 2024/2025 bleiben für Reporting importierbar, auch wenn die
  Bestandsrelation `UNRESOLVED` ist.
- Pattfield wird als Partnerwert importiert, aber nicht global hartcodiert.
- Retouren werden nur bei eindeutiger Legacy-Order- und Mengenprüfung
  relational verknüpft.
- Schuldenreferenzen unterstützen Einzelwerte, `&`, Bereiche mit Bindestrich
  oder `bis`, Zeilenumbrüche und Leerzeichenvarianten.

## Legacy-Daten

Legacy-Felder bleiben erhalten, solange Export, historische Anzeige oder
Review-Fälle sie brauchen. Neue Kernprozesse verwenden die relationale
Inventory-/SaleLine-/ReturnAllocation-/DebtLink-Struktur.
