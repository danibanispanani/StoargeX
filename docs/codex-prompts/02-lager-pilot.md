# Codex-Prompt 2: Lager als Hybrid-SPA-Pilot

## Verwendung

Erst ausführen, nachdem Prompt 1 vollständig umgesetzt und geprüft wurde. Dieser Auftrag migriert ausschließlich `/lager`.

## Prompt

Du arbeitest im Repository `C:\dev\StoargeX` auf dem bereits umgesetzten Hybrid-SPA-Fundament.

Lies zuerst vollständig:

- `AGENTS.md`
- `docs/plans/2026-08-01-001-hybrid-spa-performance-plan.md`
- `docs/codex-prompts/01-hybrid-spa-foundation.md`
- `docs/inventory-domain.md`
- `docs/operational-table-system.md`
- `docs/operational-module-migration.md`

Prüfe `git status --short` und den tatsächlichen Diff. Bewahre alle vorhandenen Änderungen. Erstelle keinen Commit, Branch oder Reset und führe kein Deployment aus.

### Ziel

Migriere ausschließlich `/lager` auf den neuen Hybrid-SPA-Datenfluss. Beim clientseitigen Öffnen des Tabs sollen Shell und Seitenrahmen unmittelbar erscheinen. Die Tabelle nutzt den organisationsgebundenen Query-Cache: vorhandene Cache-Daten werden sofort gezeigt und im Hintergrund aktualisiert; beim ersten uncached Laden bleibt nur der Datenbereich im Ladezustand.

Die fachliche Lagerlogik, Inventory Movements, RLS, Rollen, Legacy-Kompatibilität und die vorhandenen Detail-/Historienpfade bleiben autoritativ.

### Vorher messen

1. Stelle sicher, dass genau eine Devserver-Instanz läuft.
2. Nutze die zuletzt belegte warme Orientierung von ungefähr 685 ms für den Lager-Loader und 1.316 ms für den vollständigen authentifizierten GET, erfasse aber vor dem Umbau mindestens fünf aktuelle authentifizierte warme Navigations-/GET-Läufe für `/lager` sowie die typischen aktuell messbaren Lageraktionen.
3. Trenne kalte Kompilierung, Shell-/RSC-Navigation, API-Datenzeit, Queryzeiten und sichtbaren Tabellenzustand.
4. Verwende die vorhandene `[lager-performance]`-Instrumentierung und den reproduzierbaren Benchmark, erweitere sie nur datenschutzarm.
5. Falls keine authentifizierte Browsersitzung verfügbar ist, implementiere und teste den Code weiter, kennzeichne Browser- und End-to-End-Messwerte aber ausdrücklich als nicht verifiziert. Fordere keine Zugangsdaten an und erfinde keine Messwerte.

### Umsetzung

1. Mache `app/(app)/lager/page.tsx` zu einer dünnen Routenkomposition, die nicht mehr die komplette Tabelle blockierend lädt. Nutze den Organisationsscope aus dem gemeinsamen Fundament; führe keine zweite parallele Auth-/Tenant-Grundlage ein.
2. Erstelle einen getypten, schmalen Lager-Read-Vertrag unter der bestehenden API-Konvention. Der Handler verwendet `resolveApiOrgContext`, `tenantDb` und den vorhandenen `lib/stock/lager-query-loader.ts`. Ein Client-`organizationId` darf niemals die serverseitige Auswahl bestimmen.
3. Antworte für Tenantdaten privat und ohne öffentlichen/shared HTTP-Cache. Der bewusste Cache liegt im organisationsgebundenen TanStack-Query-Client.
4. Extrahiere eine Lager-Screen-Komponente, die Page Header, Filter und Tabelle erhält. Beim ersten Load zeigt nur der Tabellenbereich einen stabilen Skeleton; bei Background-Refresh bleiben bestehende Zeilen sichtbar und ein dezenter Aktualisierungszustand erkennbar.
5. Überführe URL-Suche, Ansichten, Filter und Sortierung in deterministisch normalisierte Query Keys. Die sichtbare Suche reagiert sofort; Netzwerkabfragen werden kurz debounced. Veraltete Antworten dürfen neuere Eingaben nicht überschreiben.
6. Nutze die vorhandenen Zeilenprojektionen und `applyStockMetadataPatch`. Metadatenänderungen aktualisieren die betroffene Zeile sofort oder entfernen sie, wenn sie nicht mehr zur aktuellen Suche passt. Bei Serverfehler wird der vorherige Snapshot wiederhergestellt.
7. Lade Historie, Dokumente, Wareneingänge, Storno- und Lieferantenretourendetails weiterhin ausschließlich lazy beim Öffnen des Drawers. Prefetch ist nur für klar wahrscheinliche nächste Aktionen zulässig und darf keinen N+1-Initialload erzeugen.
8. Erstellen, Storno, Retouren und andere Bestandsbewegungen bleiben über die bestehenden transaktionalen Services. Zeige sofort einen lokalen Pending-Zustand, erfinde aber keine Endmenge. Spiele das kanonische Serverergebnis ein oder invalidiere exakt die betroffenen Lager-/Einkauf-/Retouren-/Dashboard-Keys gemäß der Invalidierungszuordnung.
9. Entferne `router.refresh()` oder breites Neuladen aus migrierten Lagerinteraktionen. Entferne fachliche `revalidatePath`-Aufrufe nur dort, wo die vollständige Cross-Modul-Wirkung durch gezielte Cache-Aktualisierung ersetzt und getestet ist. Andernfalls dokumentiere sie als Übergang.
10. Behalte die aktuelle korrekte, begrenzte Gesamtprojektion zunächst bei. Implementiere keine mathematisch falsche Pagination, die `InventoryPosition` und Legacy-`StockItem` getrennt limitiert und danach zusammenführt. Eine DB-View/Union oder Schema-Migration ist nicht Teil dieses Auftrags und benötigt eine getrennte Entscheidung.

### Erwartetes Verhalten

- Klick, Filter- und Suchfeedback innerhalb von 100 ms sichtbar.
- Gecachter Rücksprung zu `/lager` ohne leere Tabelle und ohne blockierenden Ganzseitenloader.
- Background-Refresh verändert nicht den Fokus, Drawer-Zustand oder die aktuelle Tabelle, solange kein kanonischer Datenwechsel vorliegt.
- Sichere Metadatenänderung sofort sichtbar, mit Pending-Markierung und Rollback bei Fehler.
- Ein Erstload darf einen tabellenlokalen Skeleton zeigen; Shell, Page Header und Navigation bleiben bedienbar.
- Ziel für die warme authentifizierte Primärdatenantwort: unter 1 Sekunde. Berichte tatsächliche Werte offen, auch wenn externe Supabase-Latenz das Ziel verhindert.

### Tests

Ergänze fokussierte Tests mindestens für:

1. API 401/403 und serverseitig autoritativen Tenant-Scope;
2. private/no-store Tenantantwort;
3. Query-Normalisierung und Key-Isolation;
4. Cache-Revisit mit Background-Refresh;
5. schnelle Suche mit Debounce und Schutz vor veralteten Antworten;
6. Metadaten-Optimismus, kanonischen Patch, Entfernung aus aktueller Suche und Rollback;
7. Lazy History/Details ohne Initialabfragen;
8. Pending-/Erfolg-/Fehlerverhalten von Movement-Aktionen;
9. vollständige Invalidierungsmatrix betroffener Module;
10. unveränderte Inventory-Movement-, RLS-, Action- und Lager-Service-Invarianten.

Führe danach fokussierte Tests, `npx tsc --noEmit`, ESLint, vollständige Vitest-Suite, `npx prisma validate`, `npm run build` und `git diff --check` aus.

### Browser- und Performancenachweis

Prüfe authentifiziert mindestens:

- direkter Aufruf von `/lager`;
- Navigation von `/einkauf` oder `/verkauf` zu `/lager`;
- Wegnavigieren und gecachter Rücksprung;
- Suche und zwei typische Filterwechsel;
- Detail-Drawer/History-Lazyload;
- Metadatenänderung;
- eine fachlich sichere typische Movement-Aktion, ohne Testdaten destruktiv zu verändern.

Erfasse mindestens fünf warme Werte je zentralem Messpunkt. Berichte Median und langsamsten Wert sowie das sichtbare Verhalten. Rechne Dev-Kompilierung nicht als Produktverbesserung an.

### Abschlussbericht

Berichte:

- Architektur vorher/nachher;
- konkrete Messwerte inklusive Cache-Revisit;
- Anzahl und Art der Server-/DB-Abfragen;
- welche Interaktionen optimistisch, pending oder autoritativ invalidierend sind;
- welche `revalidatePath`-Übergänge bewusst verbleiben;
- vollständige Test-/Build-Ergebnisse;
- neue und geänderte Dateien;
- offene Grenzen, insbesondere korrekte gemeinsame Lagerpagination;
- ausdrücklich: kein Deployment, Commit, Branch oder Reset.

Beende nach dem Lager-Pilot. Migriere keinen weiteren Tab in diesem Auftrag.
