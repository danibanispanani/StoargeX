# StorageX DSGVO-Datenabdeckung

Stand: 17. Juli 2026
Exportformat: `storagex-portable-export-v2`

## Geschlossene Audit-Lücke

Der frühere Export enthielt vor allem Legacy-Köpfe. Der aktuelle OWNER-Export lädt den relationalen Kern explizit über `loadOrganizationPortableData(TenantDb, Organization)`. Die explizite Liste ist Absicht: Bei einem neuen Domainmodell muss die Datenschutzabdeckung sichtbar entschieden und getestet werden.

| Bereich | Abgedeckte Daten |
|---|---|
| Organisation/Team | Organisation, Memberships mit sicherer User-Projektion, Einladungsmetadaten ohne Token |
| Stammdaten | Plattformen, Plattformaccounts, Auszahlungskonten, Partner/Rollen, Carrier, Steuern, Versandraten, SelectOptions |
| Produkt/Einkauf | Product, Purchase, PurchaseLine, Receipts und ReceiptLines |
| Bestand | InventoryPosition, OwnedStockLot, ConsignmentLot, Listings, InventoryMovement, DocumentSequence |
| Verkauf | Sale, SaleLine, SaleLineAllocation |
| Kundenretouren | Return, ReturnLine, ReturnAllocation |
| Lieferantenretouren | SupplierReturn, SupplierReturnLine |
| Schulden | Debt sowie Purchase-, Sale- und Inventory-Links |
| Import | ImportBatch und SourceReference einschließlich Status/Warnungen/Fehler |
| Kosten/Gebühren | ExpenseCategory, Expense, RecurrenceRule, FeeSchedule, FeeRule, FeeCategory |
| Preiszuordnung | ProductMarketplaceMapping und gespeicherte PricingCalculation-Snapshots |
| Aufgaben | Task, Assignment, Checklist, Activity und DomainLink |
| Features | FeatureEntitlement |
| Nachvollziehbarkeit | AuditLog; verschachtelte Inhalte werden vor Ausgabe bereinigt |
| Kompatibilität | Legacy StockItems/Listings, SaleItems und Legacy-Konsignationszeilen |

## Explizite Secret-Ausschlüsse

Nicht Bestandteil eines Nutzer- oder DSGVO-Exports sind:

- `User.passwordHash`;
- `User.totpSecret`;
- `User.recoveryCodes`;
- Auth.js Accounts, Sessions und VerificationTokens;
- `Invitation.token`;
- `Credential.secretEncrypted`;
- Access-/Refresh-/Session-Tokens;
- Schlüsselwerte mit `password`, `secret` oder `token` in verschachtelten JSON-/Metadatenfeldern.

Credential-Metadaten wie Label, Username, Plattformbezug, Notiz und Rotationstermin dürfen enthalten sein; das Secret selbst nie. `MarketplaceAccount.metadata`, Entitlement-Metadaten und Audit-vorher/nachher werden zusätzlich rekursiv bereinigt.

## Rollen, Tenant und Nachweis

Der JSON-Datenschutzexport und der vollständige XLSX-Fachauszug erfordern OWNER. Die Abfragen verwenden ausschließlich den aktiven `TenantDb`; weder `bypassDb` noch ein vom Client übergebenes `organizationId` sind Teil des Exportmoduls. RLS bleibt damit die zweite Schutzschicht.

Jeder Vollauszug erzeugt ein Audit-Event mit Organisation, Nutzer, Format und Datensatzanzahl. Der JSON-Export behält das bestehende Event `organization.export`.

Automatisierte Coverage-Tests prüfen:

- jede verbindliche Kerncollection ist im Loader und Katalog registriert;
- Einladungen, User und Credential-Metadaten verwenden sichere Projektionen;
- rekursive Secret-Schlüssel werden entfernt;
- Exportendpunkte lösen den Tenant serverseitig auf;
- der vollständige XLSX-Auszug verlangt OWNER.

## Abgrenzung

Ein Datenportabilitätsexport ist kein Datenbankbackup. Er lässt Auth- und Credential-Secrets bewusst aus und optimiert auf Verständlichkeit/Weiterverwendung. Das verschlüsselte Betriebsbackup enthält dagegen die vollständige Datenbank zur Disaster Recovery und darf ausschließlich im streng kontrollierten Backup-Workflow verarbeitet werden.
