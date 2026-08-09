---
title: Sales-Read-Performance-Pilot - Plan
type: perf
date: 2026-08-09
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
origin: docs/plans/2026-08-01-001-hybrid-spa-performance-plan.md
---

# Sales-Read-Performance-Pilot - Plan

## Ziel

Der Tab `/verkauf` wird als erster Fach-Pilot deutlich reaktionsfähiger, ohne seine sichtbare Oberfläche oder Geschäftslogik zu verändern. Das bereits vorhandene TanStack-Query-Fundament wird genutzt; RLS, frische Autorisierung für schreibende Vorgänge und alle fachlichen Services bleiben erhalten.

## Produktvertrag

| ID | Verbindliche Anforderung |
| --- | --- |
| R1 | Tabellenansicht, Spalten, Filter, URL-Verhalten, Pagination, Drawer und bestehende Workflows bleiben in der ersten Runde sichtbar unverändert. |
| R2 | Normale, nicht sicherheitskritische Lesezugriffe dürfen einen servergeprüften, signierten Organisations-/Rollensnapshot bis zu 30 Minuten verwenden. Entscheidung des Nutzers: Performance vor sofortiger Wirksamkeit einer Entziehung bei normalen Reads. |
| R3 | Schreiben sowie Bestands-, Finanz-, Export-, Sicherheits-, Entitlement- und Verwaltungsaktionen prüfen Organisation und Rolle weiterhin frisch auf dem Server. |
| R4 | RLS, Tenant-Isolation und der bestehende Movement-/Audit-Pfad bleiben unverändert wirksam. Clientdaten sind nie Autorität. |
| R5 | Die konkrete Transaktionsstrategie wird pro Read-Pfad anhand echter Messungen gewählt. Es gibt keinen globalen Umbau von `tenantDb` ohne Isolations- und Kontextbeweis. |
| R6 | Das Fachmodul erhält einen organisationsgebundenen Read-Cache; vorhandene Daten dürfen sofort gezeigt und im Hintergrund erneuert werden. |

## Nicht im Scope

- kein sichtbares Redesign und keine Änderung von Seitenroute, Tabellenvertrag oder Datenmodell;
- keine Änderung der Mutationslogik in dieser Runde;
- kein Realtime, Presence, Deployment, Commit, Branch oder Reset;
- keine globale Abschwächung von RLS oder frischer Autorisierung für sensitive Vorgänge.

## Umsetzungseinheiten

### U1 – Vertrauenswürdiger Read-Kontext und Read-Transaktionsmessung

1. Ausgangsmessung für `/verkauf` erstellen: authentifizierte warme Reads, Aufteilung in Auth-/Organisationsauflösung, Queryzeiten, Payload/Datensatzmenge und sichtbaren Ladeablauf. Keine Kompilierungszeit werten.
2. Einen ausschließlich serverseitigen, signierten Read-Snapshot für aktive Organisation/Rolle mit höchstens 30 Minuten Gültigkeit konzipieren und testen. Login, Organisationswechsel, Sign-out und Ablauf müssen den Snapshot korrekt erneuern oder verwerfen.
3. Ist ein sicherer Auth.js-Refresh im aktuellen Projekt nicht belegbar, darf keine Scheinlösung entstehen: die frische Prüfung bleibt bestehen und der Befund wird berichtet.
4. Die bestehende frische `requireOrg`-/`resolveApiOrgContext`-Prüfung für alle Writes und sensiblen Reads unverändert lassen.
5. Einen eng begrenzten Kandidaten für einen Read-Transaktionshelfer nur dann ergänzen, wenn der Prisma-Transaktionskontext und `SET LOCAL app.current_org_id` innerhalb der tatsächlichen Query nachweislich erhalten bleiben. `tenantDb` nicht global umbauen.
6. Alt und Kandidat messen. `Promise.all` innerhalb einer einzelnen interaktiven Prisma-Transaktion nicht als Parallelitätsgewinn annehmen. Nur nachweislich mindestens gleich sichere und schnellere Variante übernehmen.

### U2 – Unsichtbare `/verkauf`-Read-Migration

1. Die Route als dünne Komposition belassen und die Listenprojektion über einen privaten, getypten Read-Vertrag plus organisationsgebundenen Client-Cache laden.
2. Den vorhandenen Tabellenvertrag vollständig erhalten: gleiche Queryparameter, Filter, Sortierung, Seitengröße, Spalten und Drawer.
3. Die Startliste auf die tatsächlich sichtbaren Felder begrenzen. Tiefe Relationen, Historie und Editor-Daten erst beim bereits vorhandenen Öffnen des jeweiligen Details laden; keine Inhaltseinbuße im Drawer.
4. Bei Cache-Revisit vorhandene Daten sofort sichtbar halten; beim ersten ungekachten Laden ausschließlich den Datenbereich laden. Die angezeigte Oberfläche darf sich nicht funktional ändern.
5. Aktionen bleiben zunächst auf ihrem etablierten Serverpfad. Erst nach einer geprüften Invalidierungsmatrix folgt ein separater Auftrag für lokale Mutation-Patches.

## Test- und Messvertrag

- Teste Tenant-Isolation, abgelaufenen Snapshot, Organisationswechsel, Sign-out sowie den Erhalt frischer Prüfungen bei Writes.
- Teste den Kandidaten für den Read-Transaktionspfad gegen RLS/Isolation und gegen die vorhandene Querysemantik.
- Teste Query-Key-Isolation, URL-Normalisierung, private/no-store-Antworten, Cache-Revisit, Lazy Details und unveränderte Drawer-/Tabellenabläufe.
- Führe fokussierte Tests, `npx tsc --noEmit`, ESLint, vollständige Vitest-Suite, `npx prisma validate`, `npm run build` und `git diff --check` passend zum echten Diff aus.
- Messe vor/nachher mindestens fünf warme authentifizierte Läufe für Listen-Read und Cache-Revisit. Berichte Median, langsamsten Wert, DB-Abfragen/Transaktionsverhalten sowie sichtbares Feedback. Fehlen Browserzugriff oder valide Authentifizierung, klar als nicht gemessen markieren.

## Definition of Done

- Kein ungetesteter Sicherheitsabbau und keine Organisation aus Clientwerten autorisiert.
- Die 30-Minuten-Ausnahme ist technisch belegt oder offen als nicht sicher umsetzbar dokumentiert.
- Die `/verkauf`-Oberfläche verhält sich sichtbar wie zuvor, lädt aber nicht mehr die gesamte Listenansicht blockierend über die Route.
- Messwerte zeigen den tatsächlichen Effekt; keine Behauptung aus Kompilierungszeit oder synthetischen Requests.
- Alle geänderten und relevanten unveränderten Dateien, Tests, Grenzen und verbleibenden Risiken sind im Abschlussbericht aufgeführt.
