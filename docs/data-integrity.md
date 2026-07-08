# Data Integrity

## Kommando

```bash
npm run integrity:check
```

Das Script `scripts/integrity-check.mjs` verbindet sich mit `DATABASE_URL`,
prüft produktive Daten per SQL und beendet sich mit Exit-Code `1`, sobald ein
Error-Check Zeilen findet.

## Prüfungen

- negative Mengen auf `InventoryPosition`,
- `OWNED` ohne `OwnedStockLot`,
- `CONSIGNMENT` ohne `ConsignmentLot`,
- falsche Spezialisierung pro Inventory-Type,
- `SaleLineAllocation` größer als `SaleLine.quantity`,
- `ReturnAllocation` größer als verkaufte Allocation,
- `SaleLine` ohne `Sale`,
- cross-tenant Links bei Debt-Purchase, Debt-Sale und Debt-Inventory,
- doppelte Dokumentnummern innerhalb einer Organisation,
- Movement-Replay gegen gespeicherte Mengen.

## Interpretation

Ein grüner Check beweist nicht, dass alle historischen Legacy-Zeilen fachlich
perfekt migriert sind. Er beweist, dass die neue relationale Kernstruktur keine
bekannten strukturellen Inkonsistenzen enthält.

## Legacy-Cleanup-Gate

Legacy-Tabellen oder Felder dürfen erst entfernt werden, wenn alle Punkte grün
sind:

- Prisma Validate,
- Migration Check,
- Typecheck,
- Lint,
- Unit- und Integration-Tests,
- Production Build,
- Import-Test,
- `npm run integrity:check`.

Aktueller Stand: Legacy-Strukturen bleiben bewusst erhalten, weil Import,
Export und historische Anzeigen sie weiterhin benötigen.
