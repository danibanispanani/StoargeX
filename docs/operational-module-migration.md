# Operational Module Migration

Stand: 17. Juli 2026
Phase: Prompt 8

## Ziel und Abgrenzung

Prompt 8 migriert die vorhandenen operativen Module auf die gemeinsame App Shell, die StorageX-Produktsprache und das in Prompt 3 eingeführte Tabellen-System. Die Migration verändert keine Bestands-, Verkaufs-, Retouren-, Konsignations-, Schulden- oder Berechtigungslogik. Es wurde keine Prisma-Migration erstellt.

Die verbindlichen Grenzen bleiben:

- Verkäufe werden über den bestehenden Storno-Service storniert und nicht gelöscht.
- Bestandsmengen werden ausschließlich über vorhandene Movement-/Korrekturservices verändert.
- Kunden- und Lieferantenretouren bleiben getrennte Routen, Tabellen und Workflows.
- Konsignationsdaten bleiben Domain-Kern und werden nicht gelöscht oder umgeschrieben, wenn das Add-on fehlt.
- Credentials bleiben serverseitig rollenbeschränkt; Secrets werden nicht in Tabellenkonfigurationen oder Metadaten aufgenommen.
- Import und Export verwenden weiterhin die bestehende `ImportBatch`-/`SourceReference`-Pipeline.

## Gemeinsame Tabellenarchitektur

`lib/operational-modules.ts` ist die dokumentierte Konfiguration der zehn migrierten operativen Tabellen. Jede Definition besitzt:

- einen stabilen Tabellen- und Routen-Schlüssel,
- ausschließlich modulspezifische Ansichten,
- die verfügbaren Spalten,
- Pflichtspalten,
- Standardspalten.

Die Konfiguration enthält keine Fachabfragen und keine Mutationen. Filter, Zeilen, Drawer und Aktionen bleiben beim jeweiligen Modul.

Der frühere `CompactTableShell` ist jetzt ein Kompatibilitätsadapter auf den bestehenden `OperationalTableWorkspace`. Dadurch verwenden auch schrittweise migrierte Tabellen dieselbe Mechanik für:

- organisations- und benutzerbezogene Einstellungen,
- Spaltensteuerung,
- kompakte oder komfortable Dichte,
- gespeicherte Ansichten inklusive Query-String,
- Trefferzahl,
- URL-basierte Modulansichten.

Der Adapter übergibt absichtlich keine Zeilen-IDs. Damit wird keine Ergebnismengen-Auswahl oder Bulk-Aktion angezeigt, solange ein Modul dafür keinen sicheren serverseitigen Vertrag besitzt. Lager behält seine bestehende, ausdrücklich auf Legacy-Zeilen begrenzte Bulk-Logik. Einkauf und Produkte behalten ihre vollständige result-set-fähige Workspace-Implementierung.

## Modulstand

| Modul | Operative Ansichten | Suche und Schwerpunkt | Fachaktionen |
|---|---|---|---|
| Lager | Standard, Bestand, Einkauf, Listings, Prüfung/Defekt, Alle | Lager-Nr., Produkt, Variante, EAN, Lieferant; vorhandene Status-, Datums-, Zahlungs- und Plattformfilter | Details, Listingstatus, Legacy-Bulk, Movement-basierte Bestandskorrektur |
| Einkauf | Standard, Offen, Unterwegs, Eingetroffen, Rückgabefristen, Finanzen, Alle | serverseitige Suche, Filter, Sortierung und Pagination aus Prompt 4 | Teil-/Vollwareneingang, Details, Import/Export |
| Verkauf | Standard, Finanzen, Versand, Auszahlung, Alle | vorhandene Suche und Filter; Preset bleibt bei Filterwechsel erhalten | Details, Bearbeiten, Status/Rechnung, Service-Storno, Import/Export |
| Kundenretouren | Standard, Prüfung, Finanzen, Erstattung, Alle | R-Nummer, Verkauf, Artikel, Grund, Tracking | Details, Bearbeiten, getrennte Kundenretouren-Transitions |
| Lieferantenretouren | Standard, Rückgabefristen, Versand, Erstattung, Konflikte, Alle | LR-Nummer, Einkauf, Lieferant, Artikel, RMA, Tracking | Planung, Versand-Movement, Erstattung, Ablehnung, Details |
| Konsignation | Standard, Partner, Bestand, Verkauf, Auszahlung, Alle | K-Nummer, Partner, Artikel, EAN | Details und bestehende Konsignationsaktionen hinter Entitlement |
| Schulden | Standard, Buchhaltung, Fälligkeiten, Beglichen, Alle | SCH-Nummer, Bezug, Beschreibung, Schuldner, Empfänger | Relationale Details, Status/Eintrag, Bearbeiten, rollenbasiertes Löschen |
| Versand | Standard, Aktiv, Inaktiv, Alle | Dienstleister, Tarif, Zone | Tarif anlegen, bearbeiten, aktivieren/deaktivieren, sicher bestätigen/löschen |
| Zugangsdaten | Standard, Nach Plattform, Rotation, Alle | Label, Benutzername, Plattform | zeitlich begrenztes Anzeigen, Kopieren, Löschen; nur ADMIN/OWNER |
| Team | Mitglieder, Einladungen, Rollen, Alle | Name und E-Mail | Einladung, Rolle, Widerruf; bestehende serverseitige Rollenregeln |

Einstellungen sind kein Tabellenmodul. Die Route verwendet deshalb einen kompakten Verwaltungs-Toolbar und flache, klar getrennte Formularbereiche für Organisation, Accounts, Auswahlwerte, Steuern, Abrechnung und Sicherheit.

## Detail Drawer und visuelle Sprache

Der gemeinsame Drawer verwendet keine gestapelten dekorativen Karten mehr. Er besitzt:

- einen beim Scrollen sichtbaren Kopf,
- eine mobile Vollbreite und begrenzte Desktopbreite,
- flache, durch Linien getrennte Informationsbereiche,
- einheitliche technische Abschnittsüberschriften,
- relationale und finanzielle Detailraster.

Die Haupttabellen behalten operative Kerndaten. Historische, relationale und technische Informationen bleiben in Drawern oder optionalen Spalten.

## Entitlement-Verhalten der Konsignation

Die Route prüft `CONSIGNMENT` serverseitig vor jeder Datenabfrage:

- aktiv: Tabelle und Mutationen sind verfügbar,
- Trial: bestehende Shell-/Bannerlogik kennzeichnet die Restlaufzeit und erlaubt den berechtigten Zugriff,
- inaktiv: `FeatureGate` zeigt den Add-on-Einstieg; operative Daten werden weder abgefragt noch verändert oder gelöscht.

Die bestehenden serverseitigen Konsignationsaktionen prüfen das Entitlement zusätzlich. Historische Verkaufs-, Retouren- und Bestandsrelationen bleiben unverändert gespeichert.

## Responsive und barrierearme Interaktion

- Tabellen liegen in horizontal scrollbaren Arbeitsbereichen; operative Schlüsselspalten können sticky bleiben.
- Toolbar, Suche, Ansichten und Header umbrechen auf Tablet und Mobile.
- Drawer werden auf Mobile vollbreit und bleiben vertikal scrollbar.
- Selects, Buttons, Checkboxen und Suchfelder behalten sichtbare Labels beziehungsweise `aria-label`.
- Dichte- und Spalteneinstellungen verändern nur die Darstellung, nicht die Datenbasis.
- Modulansichten und Filter sind URL-basiert; Zurücknavigation und gespeicherte Ansichten bleiben reproduzierbar.

## Verifikation

Ergebnis des finalen lokalen Laufs:

- Modulkonfiguration, Tabellenpräferenzen, Entitlement und Navigation: bestanden.
- Vollständige Vitest-Suite: 45 Dateien, 303 Tests, bestanden.
- Prisma Validate und Generate: bestanden.
- TypeScript und ESLint: bestanden.
- Next.js 15 Production Build: bestanden; alle migrierten Routen sind enthalten.
- Integrity Check: bestanden; alle 13 Invarianten melden null Verstöße.
- Prisma-Migrationsstatus: aktuell; die bereits vorhandene additive Prompt-7-Migration `20260715160000_team_task_management` wurde auf der ausdrücklich freigegebenen QA-Datenbank angewendet. Prompt 8 hat keine neue Migration erzeugt.
- Authentifizierter Chrome-DevTools-Lauf: bestanden für Dashboard, Lager, Einkauf, Verkauf, Kundenretouren, Lieferantenretouren, Konsignation, Schulden, Versand, Aufgaben, Team, Zugangsdaten und Einstellungen.
- Viewports: 1440 px Desktop, 768 px Tablet und exakt 390 × 844 px Mobile-/Touch-Emulation. Keine Route besitzt dokumentweites horizontales Overflow; breite Tabellen scrollen in ihrem eigenen Arbeitsbereich.
- Interaktionen: Lager-Detail-Drawer, modulspezifische Ansichten, mobile Navigation, Escape-Schließen, Fokuswiederherstellung und sichtbarer Fokus bestanden.
- Console/Network: nach dem Migrations- und Responsive-Fix keine Runtime-, Hydration- oder Console-Fehler; die final geprüften Dokumentrequests liefern HTTP 200.
- Rollenprüfung: der password-only QA-`MEMBER` erhält serverseitig keinen Zugriff auf den ADMIN-/OWNER-Tresor. Die Route liefert den vorgesehenen Berechtigungshinweis statt geschützter Inhalte.

Der Browserlauf deckte zwei reale Umgebungs-/UI-Abweichungen auf und verifizierte ihre Behebung:

1. `/aufgaben` scheiterte zunächst an der fehlenden, bereits versionierten Prompt-7-Spalte `tasks.snoozed_until`; nach Deployment der einzigen ausstehenden additiven Migration lädt die Route fehlerfrei.
2. Das Einkaufsfilter-Grid erzwang bei 768 px sechs feste Spalten. Es verwendet nun bis `xl` ein responsives Zwei-Spalten-Layout; bei 768 px und 390 px bleibt das Dokument innerhalb des Viewports.

## Post-Deploy Monitoring & Validation

Validierungsfenster: erste 24 Stunden nach Bereitstellung; verantwortlich ist der ausrollende OWNER/ADMIN.

- In Serverlogs nach Fehlern der Routen `/lager`, `/einkauf`, `/verkauf`, `/retouren/kunden`, `/retouren/lieferanten`, `/konsignation`, `/schulden`, `/versand`, `/zugangsdaten`, `/team` und `/einstellungen` suchen.
- Clientseitig auf Hydration-Fehler, nicht auflösbare RSC-Requests und fehlgeschlagene Server Actions achten.
- Gesundes Signal: Seitenantworten ohne 5xx, stabile RSC-Navigation, konsistente Trefferzahlen beim Ansichtswechsel und unveränderte Erfolgsraten bestehender Mutationen.
- Fehlersignal: leere Tabellen trotz vorhandener Daten, Preset-/Filterverlust, verdeckte Pflichtspalten, unberechtigte Konsignationsmutation oder direkte Bestandsänderung.
- Bei einem Fehlersignal UI-Commit zurückrollen; keine Datenmigration ist rückgängig zu machen. Fachaktionen bleiben auf den vorherigen Services und benötigen keinen Daten-Rollback.
