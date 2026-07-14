# StorageX Operational Table System

Stand: 13. Juli 2026
Phase: Prompt 3 – gemeinsame Tabellenmechanik und Produktreferenz

## Ziel und Scope

Das Operational Table System ist die gemeinsame Arbeitsmechanik für informationsreiche interne Tabellen. Prompt 3 migriert ausschließlich `/produkte` vollständig. Lager, Verkauf und weitere Module behalten ihre bestehenden Tabellen, bis ihre fachlichen Konfigurationen separat umgesetzt werden.

Das System verkleinert Tabellen nicht blind. Primäre Identität, operativer Zustand und sichere nächste Handlung bleiben sichtbar. Sekundäre Stammdaten, technische Werte und Historie werden über optionale Spalten und den Detail Drawer erreichbar.

## Architektur-Seam

```text
URL / Server Query                    Browserpräferenz
Suche · Filter · Sort · Seite         Spalten · Dichte · benannte Ansicht
             \                         /
              \                       /
          Operational Table Interface
        Query-Normalisierung · Auswahl
        Persistenzvalidierung · Controls
                       |
                       v
              Fachliche Konfiguration
        Produktspalten · Presets · Drawer
        Prisma-Where · Aktionen · Export
```

Die gemeinsame Mechanik liegt in `lib/operational-table.ts` und `components/table/operational-table-workspace.tsx`. Sie kennt keine Produkt-, Bestands- oder Verkaufsregeln. Das Produktmodul definiert seine Spalten, Presets, Query-Übersetzung und Fachaktionen in `lib/products/product-table.ts` sowie den Produktkomponenten.

Der Interface-Vertrag ist bewusst klein:

- Organisation, Benutzer und Tabellen-Key für die Präferenz-Scope;
- freigegebene und standardmäßig sichtbare Spalten;
- aktuelle Seiten-IDs und Gesamtzahl für die Auswahlsemantik;
- aktuelle URL-Query;
- fachlicher Tabellen-Renderer und optionale Bulk-Aktionen.

## Zustandsmodell

### URL-restaurierbarer Serverzustand

Suche, Preset, kombinierbare Filter, Datumsbereich, Sortierung, Richtung, Seite und Seitengröße liegen in der URL. Ungültige Werte werden auf freigegebene Defaults normalisiert. `/produkte` verwendet serverseitige Prisma-Filter und `count`/`skip`/`take`.

Die Suche ist für Name, Variante, Kategorie und Marke groß-/kleinschreibungsunabhängig. EAN wird als exakte Zeichenfolge ohne Case-Transformation durchsucht. Filter für Kategorie und Marke sind ebenfalls case-insensitive.

### Gespeicherte Benutzeransichten

Spalten, Dichte und benannte Ansichten werden unter

```text
storagex:table:<organizationId>:<userId>:<tableKey>:v1
```

im Browser gespeichert. Der Adapter validiert jede geladene Struktur gegen freigegebene Spalten und zulässige Dichtewerte. Eine benannte Ansicht speichert URL-Query, Spalten und Dichte. Der Scope verhindert, dass eine Ansicht beim Wechsel von Organisation oder Benutzer übernommen wird.

Pro Scope werden höchstens 20 benannte Ansichten behalten. Ein Wechsel von Query, Preset, gespeicherter Ansicht oder Organisation hebt eine bestehende Zeilenauswahl auf, damit eine `all`-Auswahl nie still auf eine andere Ergebnismenge umgedeutet wird.

Diese Phase führt bewusst keine Schema-Migration für server-synchronisierte Präferenzen ein. Die Persistenz-Seam kann später einen Datenbankadapter erhalten, ohne die Tabellenkonfiguration zu verändern.

### Auswahl

Zwei Zustände decken große Treffermengen ohne tausende Client-IDs ab:

- `explicit`: ausgewählte IDs;
- `all`: gesamte aktuelle Ergebnismenge minus explizite Ausschlüsse.

„Alle auf dieser Seite“ selektiert die sichtbare Seite. Anschließend kann die gesamte gefilterte Ergebnismenge gewählt werden. Bulk-Aktionen senden nur den Selektionsdeskriptor und die normalisierte Query. Der Server löst die tatsächlichen IDs erneut über den tenant-gescoppten Prisma-Client auf.

## Gemeinsame Fähigkeiten

| Fähigkeit | Vertrag |
|---|---|
| Suche | Server- oder clientseitig je Datenmenge; Produkte serverseitig |
| Sortierung | Freigegebene Spalten, auf-/absteigend, stabiler ID-Tiebreaker |
| Filter | Kombinierbar; Produkte: Kategorie, Marke, Änderungszeitraum |
| Presets | Pro Modul konfiguriert, nicht global erzwungen |
| Spalten | Validierte Auswahl; primäre Identität kann geschützt werden |
| Dichte | Komfortabel oder kompakt |
| Auswahl | Seite, einzelne Zeile, gesamte gefilterte Ergebnismenge, Ausschlüsse |
| Bulk | Server löst Tenant und Filter erneut auf; sichere Bestätigung erforderlich |
| Row Actions | Fachlich benannte Details, Bearbeiten und referenzgeprüftes Löschen |
| Pagination | Produkte: 25/50/100; keine Virtualisierung bei seitenweiser Serverabfrage |
| Sticky Header | Bestehende `sx-datatable`-Sprache; Auswahl und Identität sticky |
| Zustände | Loading Route, gefilterter Empty State, App Error Boundary |
| Export | Gleicher Query-Builder wie die Seite; aktive Filter und Sortierung bleiben erhalten |
| Detail Drawer | Stammdaten, Verwendung und Zeitstempel ohne Verlust der Tabellenansicht |

### Snapshot-sichere Gesamtmengenauswahl

Bulk-Aktionen senden neben Selektionsdeskriptor und normalisierter Query den bestätigten Zähler. Bei einer Gesamtmengenauswahl kommt ein SHA-256-Snapshot der sortierten Produkt-IDs hinzu. Der Server löst die IDs erneut über den tenant-gescoppten Prisma-Client auf und verwirft die Aktion, wenn Anzahl oder Snapshot inzwischen abweichen. Damit können weder neu hinzugekommene noch bei gleicher Anzahl ausgetauschte Treffer unbemerkt in die bestätigte Aktion gelangen.

## Produktreferenz

### Presets

- `Katalog`: alle passenden Produkte;
- `Verwendet`: mindestens eine Einkaufs-, Lager- oder Verkaufsposition;
- `Unbenutzt`: keine dieser Relationen;
- `Niedriger Bestand`: aktive InventoryPosition am Organisations-Schwellwert.

Ein Archiv-Preset wird nicht simuliert: `Product` besitzt derzeit keinen Active-/Archive-Zustand. Eine spätere Archivierung benötigt eine additive, separat freigegebene Domain-/Schemaentscheidung.

### Spalten

Standard: Produkt, Variante, Kategorie, Marke, Nutzung.
Optional: EAN, Standard-EK, Größe, Bilder, geändert am.

Die Produktidentität bleibt als geschützte sticky Spalte sichtbar. Der Drawer zeigt zusätzlich Anlage-/Änderungszeit, Bildanzahl und getrennte Nutzungszahlen für Einkauf, Lager und Verkauf.

### Sichere Aktionen

- Bearbeiten erweitert den bestehenden Produktdialog um Marke und Größe.
- Löschen prüft vorab Einkaufs-, Lager- und Verkaufsreferenzen. Referenzierte Produkte bleiben erhalten.
- Bulk-Kategorisierung löst die Auswahl erneut im Tenant auf, begrenzt auf 5000 Produkte, verändert keine Bestands-/Belegdaten und schreibt einen AuditLog.

## Tenant- und Sicherheitsvertrag

- Seite und Actions beginnen mit `requireOrg`; schreibende Aktionen erfordern mindestens `MEMBER`.
- Prisma-Abfragen verwenden `tenantDb` und damit `app.current_org_id`/RLS.
- Bulk-IDs aus dem Client sind niemals autoritativ. Nur vom tenant-gescoppten Server erneut gefundene IDs werden aktualisiert.
- Export und Vorlagendownload prüfen Session und aktive Mitgliedschaft.
- API-Routen verwenden mit `resolveApiOrgContext` dieselbe Organisations-, Rollen- und Tenant-Grundlage wie `requireOrg`.
- Produktimport schreibt über die bestehende Transaktion und Provenienzmodule.

Produkt-CSV-Zellen mit formelfähigen Präfixen werden neutralisiert. Der synchrone Produkt-Export ist auf 10.000 gefilterte Zeilen begrenzt; größere Ergebnismengen erhalten eine klare Aufforderung, die Filter einzugrenzen, statt den Route-Prozess unbeschränkt zu puffern.

## Responsive und Accessibility

- Die Seite selbst erhält keinen horizontalen Overflow; nur der Tabellencontainer scrollt horizontal.
- Sticky Header und Identität erhalten opake Hintergründe und sichtbare Trennlinien.
- Auswahl verwendet Radix-Checkboxen mit benannten Controls und Indeterminate-State.
- Sortierlinks beschreiben die nächste Richtung per `aria-label`.
- Dialoge und Drawer verwenden Radix-Fokusfalle, Escape und Fokus-Rückgabe.
- Dichte, Spalten und benannte Ansichten sind native beziehungsweise semantische Controls.
- Reduced Motion deaktiviert Drawer-/Dialog-Animationen über die bestehenden Primitives.

## Testoberfläche

- Konfigurations- und Query-Normalisierung;
- case-insensitive kombinierte Filter und Datumsbereiche;
- bidirektionale Sortierung;
- organisations-/benutzerspezifische Präferenz-Persistenz;
- Seiten- und Gesamtmengenselektion inklusive Ausschlüssen;
- referenzsicheres Löschen und tenant-aufgelöste Bulk-Kategorisierung;
- Produktvorlagen, Importkonflikte und Provenienz;
- Export mit identischem aktivem Filterzustand.

## Abnahme am 13. Juli 2026

Die authentifizierte Produktansicht wurde mit Chrome DevTools bei 1440, 1280, 768 und exakt 390 Pixeln geprüft. Die Seite erzeugt keinen horizontalen Dokument-Overflow; nur der dafür vorgesehene Tabellenbereich scrollt. Bei 1280 Pixeln wurde dabei ein zu breites Filter-Aktionsraster gefunden und responsiv korrigiert. Desktop-Sidebar, mobile Navigation, Sticky Header, Sticky-Identität, Vollbild-Drawer und Fokus-Rückgabe funktionieren in den vorgesehenen Zuständen.

Browsergeprüft sind außerdem case-insensitive Suche, kombinierte Kategorie-/Markenfilter, bidirektionale Sortierung, modulspezifische Presets, Pagination, optionale Spalten, Dichtepersistenz, gespeicherte Ansichten, Einzel-/Seiten-/Gesamtmengenauswahl, der geschützte Einstieg in die Bulk-Kategorisierung sowie CSV-/XLSX-Vorlagen und gefilterter Export. Die Prüfung hinterließ keine fachliche Datenänderung und setzte temporäre Tabellenpräferenzen anschließend zurück.

Der finale 390-Pixel-Lauf hatte eine leere Console/Issues-Liste und 34 von 34 erfolgreiche Requests. Tastaturfokus bewegt sich in DOM-Reihenfolge und erhält einen sichtbaren teal-farbenen `:focus-visible`-Rahmen. Zwei zunächst unbenannte Select-Felder wurden mit tabellenspezifischen `id`-/`name`-Attributen korrigiert.

Prisma-Validierung/-Generierung, TypeScript, ESLint, Vitest, `integrity:check`, Production Build und `git diff --check` wurden als Abschluss-Gates erfolgreich ausgeführt. Die Integritätsprüfung der konfigurierten PostgreSQL-Instanz meldet für alle 13 Invarianten null Verstöße. Der Production Build läuft mit freigegebenem Zugriff auf die konfigurierten Google Fonts vollständig durch.
