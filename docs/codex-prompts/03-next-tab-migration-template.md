# Codex-Prompt 3: Vorlage für genau einen weiteren Tab

## Verwendung

Diese Vorlage erst nach bestätigtem Lager-Pilot verwenden. Pro Codex-Auftrag genau einen Tab einsetzen. Empfohlene Reihenfolge: `/einkauf`, `/verkauf`, `/produkte`, `/dashboard`.

Ersetze vor dem Start alle Platzhalter in spitzen Klammern.

## Prompt

Du arbeitest im Repository `C:\dev\StoargeX`. Das Hybrid-SPA-Fundament und der Lager-Pilot sind bereits umgesetzt und verifiziert.

Migriere in diesem Auftrag ausschließlich den Tab `<ROUTE>` beziehungsweise das Modul `<MODUL>`. Starte keinen weiteren Tab.

Lies zuerst vollständig:

- `AGENTS.md`
- `docs/plans/2026-08-01-001-hybrid-spa-performance-plan.md`
- den Abschlussbericht beziehungsweise Diff des Lager-Piloten;
- die fachlich zuständige Dokumentation für `<MODUL>`: `<DOKUMENTPFAD>`;
- die vorhandenen Page-, Komponenten-, Action-, Service-, Query- und Testdateien des Moduls.

Prüfe `git status --short`. Bewahre alle vorhandenen Änderungen. Kein Commit, Branch, Reset oder Deployment.

### Phase A – Verstehen und messen

1. Dokumentiere die primäre operative Frage des Tabs, seine Ansichten, URL-Filter, Sortierung, Pagination, Details und alle Mutationen.
2. Erstelle eine Invalidierungsmatrix: Welche Mutation verändert `<MODUL>`, Lager, Einkauf, Verkauf, Retouren, Schulden, Konsignation oder Dashboard?
3. Kennzeichne jede Mutation als:
   - sicher optimistisch und rückrollbar;
   - lokaler Pending-Zustand mit kanonischem Server-Patch;
   - autoritativ mit gezielter Invalidierung.
4. Erfasse mindestens fünf authentifizierte warme Baselines für Tabnavigation, Primärdaten, Detailöffnung und typische Mutationen. Trenne Dev-Kompilierung.
5. Prüfe, ob Filter/Sort/Pagination heute serverseitig korrekt sind. Erfinde keine Pagination über unvereinbare Datenquellen.

### Phase B – Einen Tab migrieren

1. Mache die Route zu einer dünnen Komposition innerhalb der persistenten App Shell. Vollständige Tabellenabfragen dürfen die sichtbare Seite nicht blockieren.
2. Implementiere getypte, schmale Read-Verträge über bestehende API-Konventionen. Jeder Handler verwendet `resolveApiOrgContext`, `tenantDb`, Rollen-/Entitlement-Prüfungen und bestehende Services/Query-Builder.
3. Verwende die zentrale organisationsgebundene Query-Key-Factory. Normalisiere URL-Zustand deterministisch.
4. Zeige vorhandene Cache-Daten sofort und aktualisiere im Hintergrund. Beim uncached Erstload bleibt nur der Datenbereich im Skeleton-Zustand.
5. Lade große Details und Historie lazy. Verhindere N+1-Initialabfragen.
6. Nutze kanonische Mutationsergebnisse, sichere optimistische Patches und gezielte Invalidierungen. Kein `router.refresh()` als Standardweg.
7. Entferne `revalidatePath` nur nach vollständiger, getesteter Ablösung seiner fachlichen Auswirkungen. Dokumentiere notwendige Übergänge.
8. Bewahre URL-Restaurierbarkeit, Tabellenpräferenzen, Bulk-Semantik, Responsive-Verhalten, Accessibility und Fokusführung.
9. Ändere keine Geschäftslogik, RLS, Rollen, Entitlements, Dokumentnummern, Audit-, Import-, Berechnungs- oder Movement-Grundlagen, sofern der Auftrag dies nicht ausdrücklich verlangt.
10. Implementiere kein Realtime oder Presence. Nutze nur die vorbereitete Invalidierungsstruktur.

### Phase C – Beweisen

Ergänze konkrete Tests für:

- Tenant-/Rollen-/Entitlement-Grenzen des Read-Vertrags;
- Query-Key-Isolation und URL-Normalisierung;
- Cache-Revisit und Background-Refresh;
- Lazy Details;
- jede Mutationsklasse inklusive Fehler/Rollback;
- vollständige Cross-Modul-Invalidierung;
- bestehende fachliche Invarianten des Moduls;
- direktes Laden, Zurücknavigation, Responsive-Tabelle, Drawer und Tastaturfokus.

Führe fokussierte Tests, `npx tsc --noEmit`, ESLint, vollständige Vitest-Suite, `npx prisma validate`, `npm run build` und `git diff --check` aus.

Wiederhole die authentifizierten Messungen. Ziele:

- sichtbares Navigations-/Control-Feedback innerhalb von 100 ms;
- gecachter Rücksprung ohne leere Tabelle oder Ganzseitenloader;
- sichere lokale/optimistische Änderung innerhalb von 100 ms sichtbar;
- warme Primärdatenantwort möglichst unter 1 Sekunde;
- keine schlechtere Queryzahl oder neue N+1-Last ohne dokumentierte Begründung.

### Abschlussbericht

Berichte:

- Baseline und Nachher-Messungen mit Median/langsamstem Wert;
- sichtbares Lade- und Cache-Verhalten;
- Read-Verträge und Query Keys;
- Invalidierungsmatrix und verbleibende `revalidatePath`-Übergänge;
- fachliche Invarianten und deren Tests;
- alle neuen/geänderten Dateien sowie bewusst unveränderte relevante Dateien;
- offene Risiken und Empfehlung, ob das Muster für den nächsten Tab freigegeben werden kann;
- ausdrücklich: kein Deployment, Commit, Branch oder Reset.

Beende nach `<ROUTE>` und warte auf die fachliche Bestätigung, bevor ein weiterer Tab migriert wird.

