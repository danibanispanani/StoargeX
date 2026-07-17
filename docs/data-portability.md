# StorageX Data Portability

Stand: 17. Juli 2026
Phase: Prompt 10

## Ziel und Architektur

StorageX besitzt genau eine Importkette:

```text
Vorlage → Datei/Header → automatische Zuordnung → Mapping-Vorschau
         → Dry Run → Fehler/Duplikate/Konflikte → Review
         → bestätigter Commit → ImportBatch + SourceReference + AuditLog
```

`/daten/import` ist ein zentraler Einstieg in diese bestehende Kette. Die Route führt keine zweite Parser-, Mapping- oder Schreiblogik ein. Sie verwendet `IMPORT_TABLES`, `ImportCenterControls`, `importRowsAction` und `runMigrationImport`.

`/daten/export` ergänzt die bestehenden modulnahen Roundtrip-Exporte. Modul-Exporte behalten aktive URL-Filter und Sortierung; das Export Center stellt zusätzlich relationale Fachdatensätze, Suche, explizite Spaltenauswahl, CSV/XLSX und den vollständigen Mehrtabellen-Auszug bereit.

## Import Center

Registriert sind:

| Modul | Primäre Auflösung | Besonderheit |
|---|---|---|
| Produkte | Name/Variante, EAN | gleiche Identität ist Konflikt, kein stilles Update |
| Einkauf | Bestellnummer, Lieferant, Artikel | einfacher Fünf-Spalten-Import bleibt möglich |
| Lager | LagerID/SKU, Artikel | Bestandswirkung nur über vorhandenen Import-/Movement-Pfad |
| Verkauf | externe Order-ID, LagerID | historische/ungeklärte Relation bleibt Review-Fall |
| Kundenretouren | Order-ID | getrennt von Lieferantenretouren |
| Lieferantenretouren | Einkaufsnummer, LagerID, RMA | Einkauf und Lot müssen im Tenant gemeinsam auflösbar sein |
| Konsignation | SKU, Partnername | zusätzlich Entitlement-geschützt |
| Schulden | sichtbare Referenz, Parteien | Mehrfachrelationen bleiben Review-Fall |
| Aufgaben | Bearbeiter-E-Mail, Fachobjektnummer | unbekannte Nutzer blockieren den Import |
| Ausgaben | Partner-, Konto- und Accountname | unaufgelöste optionale Texte bleiben als Importhinweis erhalten |
| Gebührenregeln | Plattform und optionaler Accountname | ADMIN; Geltungsbereich-Duplikate blockieren |

Jedes Modul bietet leere und beispielhafte CSV-/XLSX-Vorlagen. Sichtbare deutsche Header kennzeichnen Pflichtfelder mit `*`; XLSX enthält zusätzlich `Spaltenbeschreibung`. Datums-, Zahlen- und Enumformate stehen sowohl in der UI als auch im Beschreibungssheet.

### Beziehungen

Importe verlangen keine Nutzer- oder Organisations-UUIDs. Auflösungen verwenden fachliche Identitäten:

- sichtbare Einkaufs-, Lager-, Verkaufs-, Retouren- und RMA-Nummern;
- EAN, SKU und externe Order-ID;
- E-Mail eines aktiven Organisationsmitglieds;
- konfigurierten Plattform-, Account-, Konto- oder Partnernamen.

Unbekannte oder mehrdeutige Pflichtrelationen werden als Zeilenfehler, `REVIEW_REQUIRED` oder `CONFLICT` ausgegeben. StorageX erfindet keine Zuordnung. Freitext-Fallbacks bleiben nur dort erhalten, wo das Fachmodell sie ausdrücklich erlaubt.

### Dry Run und Duplikate

Ein Dry Run erzeugt keine Domainzeile, keinen Batch und keine SourceReference. Datei- und Row-Hashes bilden weiterhin die Idempotenzanker. Bereits importierte Zeilen werden `UNCHANGED`; fachlich kollidierende neue Identitäten werden `CONFLICT`. Erst ein konfliktfreier, erneut geprüfter Dry Run schaltet den Commit frei.

Die Importhistorie zeigt bestätigte/fehlgeschlagene Batches und die Anzahl ihrer Provenienzzeilen. Konflikte bleiben über `/importe` als tenant-sichere Reviewliste erreichbar.

## Export Center

Folgende relationale Fachdatensätze stehen als CSV und XLSX bereit:

- Inventory-Ledger;
- Purchases;
- SaleLines und SaleLineAllocations;
- ReturnLines und ReturnAllocations;
- SupplierReturns;
- Expenses;
- FeeRules;
- Tasks und Assignments;
- PlatformAccounts;
- Entitlements.

Jeder Datensatz unterstützt eine case-insensitive Suche über seine Exportwerte und eine explizite Spaltenauswahl. Ohne Auswahl werden alle freigegebenen Spalten geliefert. CSV ist UTF-8 mit BOM und Semikolon; formelfähige Textpräfixe werden neutralisiert. Synchrone Einzelauszüge sind auf 50.000 Zeilen begrenzt.

Der OWNER-Vollauszug ist eine XLSX-Arbeitsmappe. Mehrere relationale Tabellen werden bewusst nicht in eine uneindeutige einzelne CSV gepresst. Für Automatisierung können die Einzeldatensätze separat als CSV abgerufen werden.

## Sicherheit und Rollen

- alle Seiten und Endpunkte verlangen aktive Organisation und Mitgliedschaft;
- Importe benötigen MEMBER, Gebührenregeln ADMIN;
- der vollständige Fachdatenauszug und DSGVO-JSON benötigen OWNER;
- alle Datenabfragen laufen über `TenantDb`/RLS;
- Konsignationsvorlagen und -Import bleiben Entitlement-geschützt;
- Auth-, Session-, Passwort-, Token-, TOTP-, Recovery- und verschlüsselte Credential-Secrets werden nicht exportiert;
- Downloads senden `private, no-store` und `nosniff`;
- der vollständige Fachdatenauszug wird auditiert.

## Erweiterungsregel

Ein neues Importmodul erweitert `TableKey`, `IMPORT_TABLES`, Planner/Validator, Commit-Service, SourceReference und Tests. Eine neue Exporttabelle erweitert den Portabilitätskatalog und einen tenant-sicheren Loader. Schema-Introspektion oder generische Tabellen-Dumps sind für Nutzerexporte nicht zulässig.
