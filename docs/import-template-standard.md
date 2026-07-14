# StorageX Import Template Standard

Stand: 13. Juli 2026
Phase: Prompt 3 – Vorlagenstandard auf der bestehenden Importpipeline

## Grundregel

Ein importierbares Modul erweitert immer die bestehende Kette:

```text
Vorlage -> Datei lesen -> Header erkennen -> Mapping -> Vorschau
         -> Dry Run -> Fehler/Konflikte -> Review -> Commit
         -> ImportBatch + SourceReference
```

Es gibt keine zweite Importengine. `IMPORT_TABLES`, `ImportExportBar`, `importRowsAction`, `runMigrationImport`, `ImportBatch` und `SourceReference` bleiben die gemeinsame Grundlage.

## Vorlagenarten

Jedes registrierte Importmodul bietet:

| Artefakt | Inhalt |
|---|---|
| Leere CSV | Freigegebene Header, Semikolon, UTF-8-BOM |
| Beispiel-CSV | Gleiche Header plus eine korrekt formatierte Beispielzeile |
| Leere XLSX | `Import`-Sheet plus `Spaltenbeschreibung` |
| Beispiel-XLSX | Beispielzeile plus `Spaltenbeschreibung` |

Pflichtfelder tragen im sichtbaren Header `*`. Die interne Zuordnung normalisiert diesen Marker, sodass heruntergeladene Vorlagen beim Upload automatisch zurückgemappt werden.

Alle registrierten Module liefern mindestens eine fachlich sinnvolle Beispielzeile; bei Pflichtfeldern darf die Beispielzeile keinen leeren Wert enthalten.

## Felddefinition

Eine Felddefinition enthält:

- stabilen technischen Key;
- sichtbares Label;
- Aliasliste für historische Quelldateien;
- Pflichtfeldkennzeichnung;
- fachliche Beschreibung;
- erwartetes Format;
- freigegebenes Beispiel.

Fehlende Metadaten älterer Module erhalten in der UI einen konservativen Text-Fallback. Neue Module müssen Beschreibung, Format und Beispiel vollständig pflegen.

## Produktvorlage

| Spalte | Pflicht | Erwartetes Format |
|---|---:|---|
| Name | Ja | Text, maximal 300 Zeichen |
| Variante | Nein | Text, maximal 200 Zeichen |
| Marke | Nein | Text |
| Kategorie | Nein | Text, maximal 100 Zeichen |
| EAN | Nein | Nur Ziffern, maximal 20 Stellen |
| Standard-EK | Nein | EUR-Dezimalzahl, zum Beispiel `34,99` |
| Größe | Nein | Text |
| Bilder | Nein | öffentliche HTTPS-URLs, kommagetrennt |

Gleicher Name plus gleiche Variante ist kein stilles Update. Der Dry Run markiert den Datensatz als `CONFLICT`; der Commit bleibt blockiert, bis die Quelldatei eindeutig bereinigt ist. Neue Produkte werden mit `targetEntity = PRODUCT` belegt.

Der Dry Run erkennt gleiche Produktidentitäten auch innerhalb derselben Datei. Name, Variante und Kategorie folgen den dokumentierten Längengrenzen; EAN, Standard-EK und jede einzelne Bild-URL werden geprüft. Ungültige oder nicht öffentliche HTTPS-Bildwerte werden nicht still verworfen, sondern als Zeilenfehler gemeldet.

## Einkaufs- und Wareneingangsvorlagen

`einkauf` und `wareneingang` verwenden dieselbe bestehende Pipeline. Beide akzeptieren als kleinste sinnvolle Datei `Datum`, `Lieferant`, `Artikel`, `Menge` und `Preis`. Einkauf erzeugt eine Bestellung ohne Bestand; eine optionale Lieferanten-Bestellnummer gruppiert mehrere Positionen. Wareneingang bucht mit StorageX-Einkaufsnummer gegen eine eindeutig offene Bestellposition und ohne diese Nummer als direkten Zugang. Zustand, Prüfung, Tracking, Rückgabefrist, Zahlung und Notiz sind optionale, validierte Felder. Dry Runs schreiben weder Purchase noch Receipt, Lot, Movement, Debt, ImportBatch oder SourceReference.

## Mapping und Vorschau

- CSV, XLS und XLSX werden weiterhin durch `xlsx` gelesen.
- Die bestehende Header-Erkennung findet auch vorangestellte Reportzeilen.
- Aliasse werden case-insensitive und whitespace-normalisiert gemappt.
- Vor dem Dry Run zeigt die UI die ersten drei gemappten Zeilen.
- Benutzer können jede Zuordnung ändern oder eine Spalte ignorieren.
- Pflichtfeldfehler werden mit Zeilennummer ausgegeben.

## Dry Run, Fehler und Konflikte

Der Dry Run schreibt keine Domainzeile und keinen ImportBatch. Er liefert:

- importierbare Zeilen;
- unveränderte/duplizierte Zeilen;
- neue Zeilen;
- verknüpfte, teilweise verknüpfte und ungeklärte Zeilen;
- Review-Zeilen;
- Konflikte;
- Fehler inklusive Zeilennummer;
- Zielentitäten und Importzusammenfassung.

`REVIEW_REQUIRED` und `CONFLICT` sind für alle Module blockierend. Eine Auflösung muss explizit erfolgen und danach erneut durch den Dry Run laufen. Die bereits vorhandene Verkaufsauflösung über historischen Import oder Ersatzbestand bleibt bestehen.

## Commit und Provenienz

Ein Commit läuft in der bestehenden Tenant-Transaktion:

1. `ImportBatch` mit Organisation, Datei, Hash, Typ und Nutzer anlegen;
2. ausschließlich importierbare Zeilen über bestehende Domain-/Prisma-Seams schreiben;
3. je Zielzeile `SourceReference` mit Row-Hash, Legacy-Referenz, Status, Warnungen und Fehlern schreiben;
4. Batch als `COMPLETED` oder kontrolliert `FAILED` abschließen;
5. AuditLog und betroffene Ansichten revalidieren.

Dry Runs dürfen keine dieser Schreiboperationen ausführen.

Produktzeilen werden beim Commit in Blöcken bis 500 Datensätzen mit `createManyAndReturn` geschrieben; die zugehörigen `SourceReference`-Zeilen folgen je Block mit `createMany` in derselben Transaktion. Die Konfliktprüfung lädt nur Katalogprodukte, deren Namen in der aktuellen Quelldatei vorkommen.

### Parallelität und Fehlerdiagnose

Produktimporte werden durch einen transaktionsgebundenen Advisory Lock pro Organisation serialisiert, damit parallele Dateien nicht dieselbe Produktidentität gleichzeitig anlegen. Schlägt die Schreibtransaktion fehl, werden Domainzeilen und der darin begonnene Batch vollständig zurückgerollt. Danach protokolliert der tenant-gescoppte Client einen separaten `FAILED`-Batch mit Quelldatei, Hash, Nutzer und Fehlermeldung. Ein Fehler dieser Diagnoseoperation verdeckt den ursprünglichen Importfehler nicht.

Die Export-/Import-Konvention für spreadsheet-formelfähige Textwerte ist reversibel: Beim Export wird ein führendes Apostroph als Escape verdoppelt und ein potenzielles Formelpräfix mit Apostroph neutralisiert; das Mapping dekodiert genau diese beiden Fälle beim Reimport.

## Download- und Tenant-Sicherheit

- Vorlagendownload erfordert eine authentifizierte aktive Mitgliedschaft.
- Die Konsignationsvorlage erfordert zusätzlich ein aktives `CONSIGNMENT`-Entitlement.
- Import-Commit erfordert mindestens `MEMBER` über `requireOrg`.
- Produkt-, Mapping- und Duplikatabfragen enthalten Organisationskontext und laufen unter RLS.
- Datei-Hash und Row-Hash bleiben die bestehenden Idempotenz-/Duplikatanker.
- Bild-Import akzeptiert in dieser Phase ausschließlich HTTPS-URLs; Secrets und lokale Pfade sind unzulässig.

## Erweiterungscheckliste für weitere Module

1. `TableKey` und `IMPORT_TABLES`-Definition ergänzen.
2. Jedes Feld mit Beschreibung, Pflichtstatus, Format und Beispiel dokumentieren.
3. Validierung und Konfliktpolitik im bestehenden Planner ergänzen.
4. Commit über vorhandenen Domain-Service oder tenant-gescopptes Prisma ausführen.
5. `ImportBatch`/`SourceReference` und Audit beibehalten.
6. Leere/Beispiel-CSV und -XLSX prüfen.
7. Dry-Run-, Fehler-, Konflikt-, Tenant- und Provenienztests ergänzen.
8. Browserprüfung von Mapping, Review, Zusammenfassung und Fokus durchführen.

## Abnahme am 13. Juli 2026

Unit- und Route-Tests decken leere und beispielhafte Vorlagen, CSV-BOM, beide XLSX-Sheets, Pflichtbeispiele aller Tabellen, Auth-/Membership-Fehler, Konsignations-Entitlement, Produktvalidierung, Konflikte, Batch-Provenienz und aktiven Exportfilter ab.

Chrome DevTools bestätigt im authentifizierten Produktmodul den Vorlagendialog mit leerer und beispielhafter CSV-/XLSX-Ausgabe, Pflichtfeldkennzeichnung, Formaten und Spaltenbeschreibungen. Die Endpunkte lieferten HTTP 200 mit korrekten Attachment-Headern für leere CSV (65 Byte) und Beispiel-XLSX (20.326 Byte). Der gefilterte CSV-Export lieferte ebenfalls HTTP 200.

Der Importdialog nutzt die bestehende Pipeline und zeigt Datei-Upload, Mapping-/Dry-Run-Einstieg und Importabschluss. Ohne Datei bleiben `Dry Run prüfen` und Import deaktiviert. Die Prüfung schloss den Dialog per Escape und führte bewusst keinen Import aus; Mapping, Fehler-/Konfliktlisten und Commit-Provenienz bleiben zusätzlich durch die automatisierten Tests abgedeckt.

`integrity:check` meldet für alle 13 konfigurierten Invarianten null Verstöße. Der Production Build läuft mit freigegebenem Netzwerkzugriff vollständig durch.
