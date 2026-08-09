---
title: Hybrid-SPA-Performancearchitektur für die geschützte Anwendung
status: approved
artifact_readiness: implementation-ready
execution: code
date: 2026-08-01
owners:
  - StorageX Product und Engineering
---

# Hybrid-SPA-Performancearchitektur

> **Teilweise abgelöst (2026-08-09):** Die allgemeine Hybrid-SPA-Architektur und das bereits umgesetzte Fundament bleiben gültig. Die darin genannte Pilot-Reihenfolge mit `/lager` als erstem Fach-Tab ist jedoch durch [Sales-Read-Performance-Pilot](2026-08-09-002-sales-read-performance-pilot-plan.md) ersetzt. Der Lager-Prompt bleibt als bewusst aufgeschobene Folgearbeit erhalten.

## Ergebnisentscheidung

Die geschützte Anwendung wird schrittweise zu einer **hybriden SPA innerhalb des bestehenden Next.js App Routers** weiterentwickelt. Es findet kein Frameworkwechsel statt. Die bestehende App Shell bleibt persistent; operative Module erhalten einen organisationsgebundenen Client-Cache, schlanke Datenverträge und gezielte Hintergrundaktualisierungen.

`StorageX` bezeichnet in diesem Dokument den aktuellen Repository-/Arbeitsnamen. Die Architektur darf weder den noch offenen Produktnamen noch ein späteres Logo technisch festschreiben.

Die Umstellung verfolgt zwei getrennte Ziele:

1. Eine Aktion des aktuellen Benutzers muss sofort sichtbares UI-Feedback erzeugen.
2. Der Server bleibt für Berechtigungen, Geschäftslogik und endgültige Daten autoritativ.

TanStack Query ist als gemeinsame Server-State-Schicht vorgesehen. Supabase Realtime und Presence werden erst nach erfolgreicher Migration und Messung der Kernmodule ergänzt.

## Problemrahmen

Der aktuelle Next.js-Aufbau ist fachlich solide, aber viele operative Routen laden ihre vollständigen Tabellen in blockierenden Server Components. Selbst nach der ersten Lageroptimierung benötigt ein warmer authentifizierter `/lager`-Loader ungefähr 685 ms und der vollständige GET ungefähr 1,3 s. Andere Tabs liegen lokal ebenfalls häufig im Sekundenbereich. Kalte Dev-Kompilierung verlängert den ersten Aufruf zusätzlich, erklärt aber nicht die warmen Wartezeiten.

Das Ziel ist deshalb nicht nur eine weitere einzelne Datenbankoptimierung. Die Wahrnehmung und der Datenfluss werden neu geordnet:

```text
Benutzeraktion
    |
    +--> sofortiger lokaler UI-Zustand
    |       Navigation · Eingabe · optimistischer Patch · Pending-Markierung
    |
    +--> organisationsgebundener Client-Cache
    |       vorhandene Daten sofort anzeigen · im Hintergrund aktualisieren
    |
    +--> autoritativer Serververtrag
            Auth · Rolle · RLS · Domain-Service · kanonisches Ergebnis
                         |
                         +--> gezielter Cache-Patch oder Invalidierung
```

## Verbindliche Anforderungen

### R1 – Bestehenden Stack bewahren

Next.js 15.5, React 19, Auth.js, Prisma, Supabase/PostgreSQL, RLS, `requireOrg`, `resolveApiOrgContext`, `tenantDb` und die bestehenden Domain-Services bleiben die Grundlage.

### R2 – Persistente Arbeitsoberfläche

Das vorhandene `app/(app)/layout.tsx` bleibt die geschützte Shell. Ein Tabwechsel darf die Sidebar, Topbar und den sichtbaren Arbeitskontext nicht durch einen ganzseitigen Ladezustand ersetzen.

### R3 – Eine Server-State-Schicht

TanStack Query verwaltet die vom Server stammenden Daten migrierter Module. Lokaler UI-Zustand bleibt in React beziehungsweise den bestehenden Komponenten. Es wird kein paralleler Redux-, Zustand- oder eigener globaler Fetch-Cache eingeführt.

### R4 – Strikte Tenant-Grenzen

Jeder API-/Read-Vertrag löst Organisation und Rolle serverseitig auf. Ein vom Client übergebener `organizationId` autorisiert nichts. Query Keys enthalten dennoch die aktive Organisation, damit Daten verschiedener Organisationen niemals im selben Client-Cache-Schlüssel liegen. Beim Organisationswechsel und Sign-out wird betroffener Cache entfernt.

### R5 – Sofortiges Feedback, Serverautorität

Eingaben und sichere Änderungen erscheinen unmittelbar. Mutationen geben kanonische Entitäten oder klar definierte Patches zurück. Optimistische Änderungen müssen abbrechbar und rückrollbar sein. Bestandsbewegungen, Storno, Retouren und andere fachlich gekoppelte Vorgänge bleiben transaktional auf dem Server.

### R6 – Gezielte Datenverträge

Listen, Optionen, Details und Historien werden getrennt geladen. Detail- und Historienabfragen erfolgen lazy beim Öffnen. Listen liefern nur die sichtbare Projektion und belastbare Metadaten wie Trefferzahl oder Cursor/Seite.

### R7 – URL und Tabellenvertrag bewahren

Suche, Filter, Sortierung, Ansicht und Pagination bleiben URL-restaurierbar. Netzwerkzugriffe dürfen debounced sein; die sichtbare Eingabe reagiert ohne Verzögerung. Die bestehende `OperationalTableWorkspace`-Semantik wird weiterverwendet.

### R8 – Korrekte Pagination

Serverseitige Pagination ist erwünscht, aber nur über eine korrekt geordnete gemeinsame Ergebnismenge. Eine getrennte Limitierung von `InventoryPosition` und Legacy-`StockItem` mit anschließendem Merge gilt nicht als korrekte Pagination. Bis eine korrekte Lösung vorliegt, bleibt beim Lager die bestehende vollständige, begrenzte Projektion bestehen.

### R9 – Messbare Abnahme

Für jeden migrierten Tab werden authentifizierte warme Messungen vor und nach der Änderung erhoben. Dev-Kompilierung wird separat ausgewiesen. Gemessen werden mindestens Navigation, erster Datensatz, Cache-Revisit, typische Mutation, Queryzahl und sichtbares Ladeverhalten.

### R10 – Realtime später, aber anschlussfähig

Query Keys, kanonische Mutationsergebnisse und eine zentrale Invalidierungszuordnung werden so angelegt, dass spätere Supabase-Broadcast-Ereignisse dieselben Caches patchen oder invalidieren können. Presence ist ein getrennter flüchtiger Kanal. In dieser Runde wird keine Realtime-Funktion ausgeliefert.

## Nicht im aktuellen Scope

- kein Wechsel zu Vite, Remix, Svelte, Vue oder einem anderen Frontend-Framework;
- kein Deployment;
- keine Supabase-Realtime-/Presence-Oberfläche;
- keine gleichzeitige Migration aller Tabs;
- keine direkte Datenbankverbindung aus dem Browser;
- keine Abschwächung von RLS, Rollenprüfung oder Tenant-Isolation;
- keine direkte Änderung von Bestandszählern außerhalb der Movement-Services;
- keine neue fachliche Lagerlogik und keine Umsetzung der noch separat zu spezifizierenden Lager-UI-Korrekturen;
- keine Erfolgsaussage allein anhand synthetischer oder unauthentifizierter Requests.

## Technische Zielarchitektur

### App- und Provider-Schicht

`app/(app)/layout.tsx` liefert den bereits autoritativ aufgelösten, minimalen Benutzer-/Organisationskontext an einen Client-Provider. Innerhalb dieser Schicht lebt genau ein stabiler `QueryClient` je Browsersitzung. Das Layout wird nicht zu einem globalen Datensammler für Fachmodule.

Empfohlene neue Seams:

- `components/providers/app-query-provider.tsx`: stabiler QueryClient und globale, zurückhaltende Defaults;
- `components/providers/active-organization-provider.tsx`: nicht-sensitive aktive Scope-Daten für Query Keys;
- `lib/query/query-keys.ts`: zentrale, typisierte Key-Factory;
- `lib/query/http-client.ts`: gemeinsamer JSON-Client und normierte Fehler;
- `lib/query/invalidation-map.ts`: dokumentierte Zuordnung von Mutationseffekten zu Modulen.

Vorgeschlagene Cache-Defaults sind Ausgangswerte und müssen im Lager-Pilot gemessen werden:

- operative Listen: circa 15 Sekunden `staleTime`;
- selten veränderte Optionen: circa 5 Minuten `staleTime`;
- Cache-Aufbewahrung: circa 10 Minuten;
- maximal ein automatischer Retry für vorübergehende Server-/Netzfehler;
- kein Retry für 401, 403 und validierte 4xx-Fachfehler.

### Query-Key-Vertrag

Beispielstruktur:

```text
["org", organizationId, "lager", "list", normalizedQuery]
["org", organizationId, "lager", "detail", positionId]
["org", organizationId, "lager", "history", positionId]
["org", organizationId, "reference", "stock-options"]
```

Die normalisierte Query muss deterministisch sein. Leere Defaultwerte werden nicht als unterschiedliche Cachevarianten gespeichert.

### HTTP- und Fehlervertrag

Tenant-Datenantworten bleiben privat und dürfen nicht in einen öffentlichen oder tenantübergreifenden Next.js-/CDN-Cache gelangen. Der Browsercache von TanStack Query ist davon getrennt und bewusst organisationsgebunden.

Die Serververträge liefern typisierte JSON-Antworten mit:

- Daten beziehungsweise kanonischem Patch;
- nötigen Metadaten wie Gesamtzahl oder Aktualisierungszeit;
- stabilem Fehlercode und sicherer, nutzergeeigneter Meldung;
- Korrelations-ID für Diagnose ohne Geschäftsinhalte im Log.

### Mutationsvertrag

Mutationen folgen abhängig vom Risiko einem von drei Mustern:

1. **Sicher optimistisch:** reversible Metadatenänderung; Cache sofort patchen, bei Fehler zurückrollen.
2. **Pending mit kanonischem Patch:** komplexere, aber zeilenlokale Aktion; Zeile als ausstehend markieren, Serverergebnis einspielen.
3. **Autoritativ mit gezielter Invalidierung:** Bestandsbewegung oder modulübergreifender Vorgang; keine erfundene Endmenge, anschließend exakt betroffene Query Keys aktualisieren.

`router.refresh()` und pauschales Neuladen des aktuellen Tabs sind in migrierten Interaktionen kein Standardweg. Bestehende `revalidatePath`-Aufrufe werden nur entfernt, wenn ihre fachlichen Abhängigkeiten vollständig ersetzt und getestet sind.

## Umsetzungseinheiten

### U1 – Gemeinsames Fundament

Ziel: Query-Provider, Organisationsscope, Query-Key-Factory, HTTP-/Fehlervertrag und Testgrundlage ergänzen, ohne ein Fachmodul zu migrieren.

Betroffene Pfade:

- `package.json`
- `package-lock.json`
- `app/(app)/layout.tsx`
- `components/providers/app-query-provider.tsx` (neu)
- `components/providers/active-organization-provider.tsx` (neu)
- `lib/query/query-keys.ts` (neu)
- `lib/query/http-client.ts` (neu)
- `lib/query/invalidation-map.ts` (neu)
- passende Tests unter `tests/`

Testszenarien:

1. Der QueryClient wird bei Client-Re-Renders nicht neu erzeugt.
2. Zwei Organisationen erzeugen unterschiedliche Keys für dieselbe Modulquery.
3. Organisationwechsel entfernt alte organisationsgebundene Daten.
4. 401/403 und Fachfehler werden nicht automatisch wiederholt.
5. Bestehende Routen funktionieren ohne Migration weiter.

### U2 – Lager als Pilot

Ziel: `/lager` zeigt Shell und Seitenrahmen ohne vollständige blockierende Tabellenabfrage, lädt seine Liste über einen getypten Read-Vertrag und verwendet Cache-/Background-Refresh sowie gezielte Mutationsupdates.

Bestehende Muster, die zu erhalten sind:

- `lib/stock/lager-query-loader.ts`
- `lib/stock/lager-performance.ts`
- `lib/stock/stock-row-update.ts`
- `lib/stock/stock-metadata-service.ts`
- `lib/actions/stock.ts`
- `components/stock/stock-table.tsx`
- `components/stock/lazy-stock-item-dialog.tsx`

Voraussichtlich betroffene beziehungsweise neue Pfade:

- `app/(app)/lager/page.tsx`
- `app/api/lager/route.ts` (neu)
- `components/stock/lager-screen.tsx` (neu)
- `lib/stock/lager-client-query.ts` (neu oder entsprechend der finalen Namenskonvention)
- fokussierte Lager-/API-/Cache-Tests unter `tests/`
- `scripts/performance/measure-lager-critical-path.mjs`

Testszenarien:

1. Der Seitenrahmen erscheint ohne Warten auf die Tabellenabfrage.
2. Der Read-Vertrag weist 401/403 korrekt ab und verwendet ausschließlich den serverseitig aufgelösten Tenant.
3. Query-Normalisierung erzeugt für semantisch gleiche URLs denselben Key.
4. Ein gecachter Rücksprung zeigt sofort Daten und aktualisiert im Hintergrund.
5. Suche/Filter zeigen sofort den neuen Control-Zustand, behalten alte Daten während des Fetches sichtbar und verwerfen veraltete Antworten.
6. Metadatenänderungen patchen genau die kanonische Zeile und rollen bei Fehler zurück.
7. Details/Historie werden erst beim Öffnen geladen.
8. Bestandsbewegungen laufen weiter ausschließlich über bestehende Services und liefern keine spekulativ erfundete Menge.
9. Bestehende Tenant-, Movement- und Action-Tests bleiben grün.
10. Authentifizierte Warmmessungen vergleichen Navigation, Erstload, Cache-Revisit und typische POST-Aktionen.

### U3 – Weitere Tabs einzeln migrieren

Reihenfolge:

1. `/einkauf`
2. `/verkauf`
3. `/produkte`
4. `/dashboard`
5. weitere operative Module nach erneuter Priorisierung

Jeder Tab erhält vor der Umsetzung eine eigene Baseline und eine Invalidierungsmatrix. Ein Tab gilt erst als Vorlage für den nächsten, wenn Browserverhalten, Tenant-Isolation, Fachinvarianten und Messwerte bestätigt sind.

Testszenarien je Tab:

1. Direkter Erstaufruf und clientseitiger Tabwechsel funktionieren.
2. Cache-Revisit blockiert die Seite nicht.
3. URL-Zustand ist nach Reload und Zurücknavigation reproduzierbar.
4. Rollen-/Entitlement-Gates bleiben autoritativ.
5. Jede Mutation aktualisiert alle fachlich betroffenen Caches und keine fremde Organisation.
6. Lazy Details verursachen keine N+1-Initiallast.
7. Responsive Tabelle, Drawer, Fokus und Fehlermeldungen bleiben funktionsfähig.
8. Vorher-/Nachher-Messungen liegen für echte authentifizierte Abläufe vor.

## Abnahmekriterien

- Navigation und Controls reagieren sichtbar innerhalb von 100 ms.
- Ein gecachter Tabwechsel zeigt keine ganzseitige Ladeansicht und keine leere Tabelle.
- Sichere optimistische oder lokale Zeilenänderungen werden innerhalb von 100 ms sichtbar; der Pending-/Fehlerzustand bleibt erkennbar.
- Der App-Rahmen bleibt während eines uncached Tabellenloads bedienbar; nur der Datenbereich zeigt einen Skeleton-/Refresh-Zustand.
- Der warme authentifizierte Primärdaten-Request eines migrierten Tabs zielt auf unter 1 Sekunde; reale externe Latenz wird offen ausgewiesen.
- Keine Query oder Mutation kann Tenantdaten anhand eines Client-Parameters autorisieren.
- Kein Bestand wird außerhalb der Inventory-Movement-Services verändert.
- Keine falsche Pagination über getrennt limitierte Lagerquellen.
- Alle fokussierten Tests, `npx tsc --noEmit`, ESLint, vollständige Vitest-Suite, Prisma-Validierung, Build und `git diff --check` bestehen, soweit die jeweilige Phase Code verändert.
- Kein Deployment, Commit, Branch oder Reset ohne ausdrückliche Freigabe.

## Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Cache zeigt Daten einer vorherigen Organisation | Organisation in jedem Key; zentraler Cache-Clear beim Wechsel; Tests mit zwei Organisationen |
| Optimistischer Zustand weicht vom Server ab | Nur reversible Felder optimistisch; Snapshot/Rollback; kanonisches Serverergebnis |
| `revalidatePath` und Client-Cache laufen auseinander | Invalidierungsmatrix pro Mutation; schrittweiser Ersatz; Cross-Modul-Tests |
| Zu großer Big-Bang-Umbau | Fundament und genau ein Pilot; danach ein Tab pro Auftrag |
| Falsche Lagerpagination | Bestehende begrenzte Gesamtprojektion behalten, bis gemeinsamer korrekter Queryplan vorhanden ist |
| Supabase-Pool wird lokal erschöpft | Genau eine Devserver-Instanz; Poolfehler separat vom Anwendungscode behandeln |
| Realtime wird zu früh zur Fehlerquelle | Erst Cache- und Mutationsverträge stabilisieren; Realtime/Presence eigene spätere Phase |

## Quellen und bestehende Projektbelege

- Next.js beschreibt den App Router ausdrücklich als SPA-fähig mit clientseitiger Navigation und Prefetching: <https://nextjs.org/docs/app/guides/single-page-applications>
- TanStack Query stellt Server-State-Caching, Request-Deduplizierung, Hintergrundupdates und optimistische Änderungen bereit: <https://tanstack.com/query/latest/docs/framework/react/overview>
- Bestehende Shell: `app/(app)/layout.tsx` und `docs/internal-app-shell.md`
- Bestehender Tabellenvertrag: `docs/operational-table-system.md`
- Aktueller Lagermesspfad: `lib/stock/lager-performance.ts`, `lib/stock/lager-query-loader.ts` und `scripts/performance/measure-lager-critical-path.mjs`

## Ausführungsreihenfolge

1. `docs/codex-prompts/01-hybrid-spa-foundation.md`
2. Resultat prüfen und authentifizierten Shell-/Navigations-Smoke-Test ausführen.
3. `docs/codex-prompts/02-lager-pilot.md`
4. Lager fachlich und anhand der Messverträge bestätigen.
5. `docs/codex-prompts/03-next-tab-migration-template.md` jeweils für genau einen Folgetab verwenden.
