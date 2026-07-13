# StorageX Internal App Shell

Stand: 13. Juli 2026
Phase: Prompt 2 – internes Designsystem und App Shell

## Ergebnis

Die geschützte StorageX-App verwendet jetzt eine gemeinsame, responsive Arbeitskonsole. Die Shell vertieft den bestehenden `(app)`-Layout-Seam; sie baut keine parallele Navigation und rekonstruiert keine Fachmodule. Bestehende Tabellen, Aktionen, Movement-Logik, RLS und historische Datenpfade bleiben die fachliche Grundlage.

Die visuelle Leitidee ist ein **operativer Ledger Rail**: kompakte Gruppierung, klare Linien, ruhige Flächen, eine schmale aktive Transit-Markierung und die vorhandene StorageX-Typografie. Marketing-Inszenierung, violette Glows, dekorative Workflow-Animationen und ein generisches Admin-Kartenmuster werden vermieden.

## App-Struktur

Die Navigation enthält nur vorhandene Routen. Noch nicht implementierte Beta-Module werden nicht als tote Links vorgetäuscht.

| Gruppe | Routen |
|---|---|
| Übersicht | Dashboard |
| Handel | Lager & Wareneingang, Produkte, Verkauf, Kundenretouren |
| Finanzen | Schulden |
| Betrieb | Versand, Konsignation, Aufgaben |
| Verwaltung | Team, Zugangsdaten, Einstellungen |

`Lager & Wareneingang` bezeichnet die vorhandene gemeinsame Route `/lager`. Einkauf, Lieferantenretouren, Profit-Rechner, Gebührenregeln und Ausgaben erhalten erst mit ihren eigenen Fachphasen eigenständige Routen.

## Gemeinsame Komponenten

| Komponente | Verantwortung |
|---|---|
| `AppSidebar` | Gruppierte Desktop-Rail, aktiver Bereich, persistenter 72/240-px-Zustand |
| `MobileAppNavigation` | Radix-Sheet mit Dialogsemantik, Fokusfalle, Escape und Fokus-Rückgabe |
| `AppTopbar` | Mobile Einstiegspunkte, Organisationskontext, Rolle, Theme und Benutzeraktionen |
| `OrganizationSwitcher` | Aktive Organisation und serverseitig erneut validierter Wechsel |
| `UserMenu` | Benutzerkontext, Einstellungen, Sicherheit und Abmeldung |
| `Breadcrumbs` | Routenbasierte Einordnung innerhalb der geschützten App |
| `PageHeader` | Gemeinsame Titel-, Kontext- und Aktionshierarchie |
| `PageToolbar` | Kompakte, zugänglich benannte Werkzeugzeile für Module |
| `InsightStrip` | Linienbasierte operative Verdichtung ohne KPI-Kartenraster |
| `EmptyState`, `ErrorState`, `LoadingState` | Gemeinsame Modulzustände ohne große dekorative Karten |
| `FeatureGate` | Servergelieferter Add-on-Einstieg ohne Zugriff auf Fachinhalte |
| `AddonTrialBanner` | Hydration-stabile, serverseitig berechnete Trial-Restlaufzeit |

Dashboard, Lager, Verkauf, Einstellungen und Konsignation verwenden den gemeinsamen `PageHeader`. Das Dashboard verdichtet seine acht operativen Werte über `InsightStrip`; Reporting-Abfragen, Zeitfilter und Diagramme bleiben unverändert.

## Responsive Vertrag

- Ab `lg` (1024 px): Desktop-Rail mit 240 px Breite, optional persistent auf 72 px reduziert.
- Unter `lg`: volle Modulbreite und mobile Sheet-Navigation.
- Topbar: 52 px hoch; Organisation wird gekürzt statt die Benutzeraktionen zu verdrängen.
- Breadcrumbs werden auf sehr kleinen Viewports ausgeblendet.
- Hauptinhalt besitzt keine globale Maximalbreite; Tabellen behalten den verfügbaren Raum.
- Navigation, Drawer und Zustandswechsel verwenden nur kurze bestehende Transitions und respektieren Reduced Motion.

## Konsignations-Entitlement

Die Prompt-1-Policy bleibt der zentrale Entscheidungskern. BUSINESS behält den kompatiblen Legacy-Zugang; aktive `SUBSCRIPTION`, `ADD_ON`, `TRIAL` und `MANUAL` Grants werden frisch aus der Datenbank ausgewertet. Gleich lange Grants werden deterministisch nach Quelle, Startzeit und ID gewählt.

```text
Session + aktive Mitgliedschaft
             |
             v
       requireOrg + RLS
             |
             v
 FeatureEntitlement + Tier-Fallback
       |                     |
    aktiv                 inaktiv
       |                     |
 Navigation/Trial       Add-on-Einstieg
 Fachseite/Aktionen     keine Fachabfrage
```

Autoritative Serverprüfungen bestehen an folgenden Neunutzungs-Seams:

- direkter Aufruf von `/konsignation` vor der ersten Fachabfrage;
- alle sechs Konsignationsmutationen;
- Konsignationsimport inklusive Dry Run;
- neue Verkäufe mit mindestens einer K-Position;
- Verkaufsimport: K-Mappings werden ohne Entitlement nicht allokiert;
- Import-Auswahllisten und Listing-Aktionen für K-Positionen.

Bewusst zugänglich bleiben historische Exporte, Reporting, bestehende Verkaufsanzeige, Kundenretouren und Stornierungen. Ein abgelaufenes Add-on darf Daten weder löschen noch rechtlich beziehungsweise bestandsseitig notwendige Korrekturpfade blockieren.

Der alte BUSINESS-Vorfilter für `/konsignation` wurde aus der Edge-Middleware entfernt. Andernfalls wären gültige FREE/PRO-Add-ons und Trials vor der frischen DB-Entscheidung auf `/pricing` umgeleitet worden. Die Middleware bleibt für Authentifizierung, Mitgliedschaft, 2FA und die verbleibenden reinen Tarif-Gates zuständig.

Die geschützte Layout-Schicht lädt Mitgliedschaft, Rolle, Organisation und Feature-Entscheidung frisch und memoisiert sie nur innerhalb des aktuellen Server-Render-Requests. Fällt die rein präsentative Shell-Abfrage aus, bleibt die Navigation fail-closed; autoritative Fachseiten und Aktionen prüfen weiterhin selbst. Ein gemeinsames App-Error-Boundary bietet für echte Seitenfehler einen klaren Wiederholen-Pfad.

## Organisationswechsel

Die Session enthielt bereits mehrere Mitgliedschaften und einen `activeOrgId`, aber keine Shell-Aktion zum Wechseln. `switchOrganizationAction` prüft den angeforderten Tenant erneut gegen die Datenbank, aktualisiert erst danach die Auth.js-Session und führt zum Dashboard. Ein vom Client frei gesetzter Organisationswert ist damit nicht autoritativ.

## Browser- und Accessibility-Prüfung

Die geschützten Routen wurden gegen einen ausschließlich lokalen temporären PostgreSQL-QA-Tenant geprüft. Die konfigurierte externe Supabase-Datenbank wurde weder für Testdaten noch für einen Auth-Bypass verwendet.

| Viewport | Dashboard | Lager | Verkauf | Aufgaben | Einstellungen |
|---:|---|---|---|---|---|
| 1440 px | bestanden | bestanden | bestanden | bestanden | bestanden |
| 1280 px | bestanden | bestanden | bestanden | bestanden | bestanden |
| 768 px | bestanden | bestanden | bestanden | bestanden | bestanden |
| 390 px | bestanden | bestanden | bestanden | bestanden | bestanden |

Geprüft wurden je Route H1/Seiteninhalt, Error Boundary, globale horizontale Überbreite, Desktop-/Mobile-Navigationszustand und Topbar. Ein zunächst gefundener 390-px-Overflow im Dashboard wurde durch `min-w-0` an zwei tabellenhaltigen Grid-Karten behoben.

Zusätzliche Nachweise:

- Mobile Drawer: Fokus startet im Dialog, Tab bleibt im Dialog, Escape schließt, Fokus kehrt zum Öffnen-Button zurück.
- Desktop-Rail: 240 -> 72 px, `aria-pressed` und LocalStorage-Persistenz nach Reload.
- Trial: FREE + aktiver Trial zeigt Navigation, 7-Tage-Banner und operative Konsignationsseite.
- Inaktiv: Direkter Aufruf bleibt auf `/konsignation`, liefert aber nur `FeatureGate`; keine Anlageaktion und kein Trial-Banner.
- Console: keine aktuellen Warnungen oder Fehler auf der abschließend geladenen Fachseite.
- Network: geprüfte Dokument-/Fetch-Aufrufe erfolgreich; Konsignation lieferte HTTP 200 in aktivem und gegatetem Zustand.
- Hydration: keine Mismatch-Meldung, kein Error Boundary und kein Next-Fehleroverlay aus Anwendungscode.

## Tool-Kompatibilität und bekannte Grenzen

- Next.js ist auf 15.5.20 fixiert. `next-devtools` benötigt für die native MCP-Runtime Next.js 16 und fand daher keinen kompatiblen Server. Es wurde kein Framework-Upgrade vorgenommen.
- Ein shadcn-MCP war in der Sitzung nicht exponiert. Die vorhandenen Radix/shadcn-artigen Primitives (`Sheet`, `DropdownMenu`, `Avatar`, `Button`) wurden direkt geprüft und wiederverwendet.
- Better Icons war nicht global installiert; der dokumentierte `npx better-icons`-Fallback wurde genutzt. Die App bleibt beim bereits installierten Lucide-System.
- Sandbox-Netzwerkzugriffe auf Google Fonts schlagen fehl; `next/font` verwendet seine Fallbacks. Chrome zeigte dadurch keine Anwendungs- oder Hydrationfehler.
- Ein lokaler `prisma migrate deploy` deckte ein bereits vorhandenes UTF-8-BOM in `20260709100000_product_brand/migration.sql` auf. Prompt 2 verändert historische Migrationen nicht; nur für die temporäre Browser-QA wurde das aktuelle Schema per `prisma db push` in eine zweite lokale Datenbank materialisiert.

## Scope-Nachweis

- Keine Prisma-Schemaänderung.
- Keine neue Migration und keine Tarifänderung.
- Keine produktiven Daten gelöscht oder migriert.
- Keine bestehende Fachberechnung, Movement- oder Importgrundlage ersetzt.
- Der temporäre lokale QA-Container und seine Testdaten gehören nicht zum Repository und werden nach Abschluss entfernt.

## Qualitäts-Gates

- `npx prisma validate`: bestanden.
- `npx prisma generate`: bestanden; der erste Windows-Lauf war nur durch die laufende lokale QA-App blockiert und wurde nach deren Beendigung erfolgreich wiederholt.
- `npx tsc --noEmit`: bestanden.
- `npm run lint`: bestanden.
- `npm test`: 22 Testdateien, 169 Tests bestanden.
- `npm run integrity:check`: gegen den isolierten lokalen QA-Tenant bestanden; alle 13 Integritätszählungen sind `0`.
- `npm run build`: bestanden. Der Sandbox-Lauf konnte Google Fonts nicht abrufen; der freigegebene Wiederholungslauf kompilierte und generierte alle 26 statischen Seiten erfolgreich.
- `ce-simplify-code` und `ce-code-review`: ausgeführt. Befunde zu frischem Tenant-Kontext, Action-Fehlern, Future-Feature-Keys, Dashboard-Erklärbarkeit, Fehlergrenzen und Tests wurden eingearbeitet; keine freigabeblockierenden Restbefunde.
- Abschließender Chrome-Recheck bei 390 px: `innerWidth = scrollWidth = 390`, keine Console-Warnung, kein Error Boundary.

## Post-Deploy Monitoring & Validation

- Suchbegriffe in Server-Logs: `App-Shell: Entitlement konnte nicht geladen werden`, `Geschützte App-Route fehlgeschlagen`, `Feature CONSIGNMENT` und Fehler auf `/konsignation`.
- Beobachten: 5xx-Rate und Server-Action-Fehler für `/dashboard`, `/konsignation`, `/verkauf` und Importaktionen; außerdem Organisation-Wechsel und Trial-Abläufe.
- Gesundes Signal: keine erhöhte 5xx-Rate, Navigation und direkte Fachseite zeigen denselben Entitlement-Zustand, abgelaufene Trials liefern einen kontrollierten Action-Fehler und erzeugen keine Bestandsbewegung.
- Eingriffsgrenze: wiederholte Shell-Entitlement-Fehler, falscher Tenant-Kontext oder eine Konsignationsmutation ohne aktiven Zugriff. Dann den Commit zurückrollen; eine Schema- oder Datenrückmigration ist nicht erforderlich.
- Validierungsfenster und Verantwortung: erste 24 Stunden nach Deployment, verantwortliches StorageX-Engineering/Product-Team.
