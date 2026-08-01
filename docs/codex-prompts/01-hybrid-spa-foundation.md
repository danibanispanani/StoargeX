# Codex-Prompt 1: Hybrid-SPA-Fundament

## Verwendung

Diesen Prompt als eigenen Codex-Auftrag ausführen. Er baut ausschließlich das gemeinsame Fundament und migriert noch keinen Fach-Tab.

## Prompt

Du arbeitest im Repository `C:\dev\StoargeX`.

Lies zuerst vollständig:

- `AGENTS.md`
- `docs/plans/2026-08-01-001-hybrid-spa-performance-plan.md`
- `docs/internal-app-shell.md`
- `docs/operational-table-system.md`

Prüfe anschließend `git status --short`. Der Arbeitsbaum enthält möglicherweise bereits nicht committete Lager-Performance-Änderungen. Diese Änderungen gehören zum vorhandenen Arbeitsstand und dürfen weder verworfen, überschrieben noch pauschal formatiert werden. Erstelle keinen Commit, Branch oder Reset und führe kein Deployment aus.

### Auftrag

Implementiere ausschließlich das gemeinsame Hybrid-SPA-Fundament für die geschützte `(app)`-Anwendung. Behalte Next.js 15.5, React 19, Auth.js, Prisma, Supabase/RLS, die bestehende App Shell und sämtliche Domain-Services bei. Es findet kein Frameworkwechsel statt.

Füge die mit React 19 und Next.js 15.5 kompatible aktuelle Version von `@tanstack/react-query` als Produktionsabhängigkeit hinzu und aktualisiere den Lockfile reproduzierbar. Keine zweite Server-State-Bibliothek und zunächst keine Query-Devtools.

Implementiere folgende Bausteine, wobei du bestehende Namens- und Testkonventionen des Repositories bevorzugst:

1. Einen Client-Provider für genau einen stabilen `QueryClient` je Browsersitzung. Der QueryClient darf nicht bei jedem Render neu entstehen.
2. Einen kleinen Client-Kontext für den bereits serverseitig autoritativ aufgelösten aktiven Organisationsscope. Übertrage nur Daten, die die geschützte UI bereits benötigt; keine Tokens, Secrets oder unnötigen vollständigen Datensätze.
3. Eine zentrale typisierte Query-Key-Factory. Jeder Tenant-Key beginnt logisch mit Organisation, dann Modul, Ressource und deterministisch normalisierter Query.
4. Einen gemeinsamen JSON-HTTP-Client mit normiertem Fehlerobjekt. 401, 403 und validierte 4xx-Fachfehler dürfen nicht automatisch retried werden; vorübergehende Netzwerk-/5xx-Fehler höchstens einmal.
5. Eine zentrale, zunächst kleine Invalidierungszuordnung für Modulabhängigkeiten. Sie soll später sowohl lokale Mutationen als auch Supabase-Realtime-Ereignisse auf dieselben Query Keys abbilden können. Implementiere noch kein Realtime.
6. Einen sicheren Cache-Reset beim autoritativ bestätigten Organisationswechsel und beim Sign-out. Der Client darf zu keinem Zeitpunkt Daten der vorherigen Organisation unter dem neuen Scope anzeigen.
7. Zurückhaltende Cache-Defaults als messbare Startwerte: operative Listen ungefähr 15 Sekunden frisch, Referenzdaten ungefähr 5 Minuten, Aufbewahrung ungefähr 10 Minuten. Begründe Abweichungen anhand des konkreten Codes.

### Sicherheits- und Architekturgrenzen

- API- oder Action-Berechtigungen bleiben vollständig serverseitig. Der Organisationswert im Client-Kontext dient nur der Darstellung und Key-Namensgebung.
- Verändere `tenantDb`, RLS, Rollen- oder Entitlement-Prüfungen nicht, außer ein klarer Test beweist, dass eine minimale Anpassung zwingend erforderlich ist. In diesem Fall stoppe vor einer risikoreichen Änderung und dokumentiere den Befund.
- Tenant-Daten dürfen nicht in einen öffentlichen oder organisationsübergreifenden Next.js-/CDN-Cache gelangen.
- Entferne noch keine fachlichen `revalidatePath`-Aufrufe. Dieses Fundament kennt ihre vollständigen Abhängigkeiten noch nicht.
- Migriere noch nicht `/lager`, `/einkauf`, `/verkauf`, `/produkte`, `/dashboard` oder andere Fachtabs.
- Implementiere kein WebSocket-, Broadcast-, Presence- oder Realtime-Verhalten.
- Starte höchstens eine lokale Devserver-Instanz.

### Tests und Verifikation

Ergänze fokussierte Tests mindestens für:

- stabile QueryClient-Lebensdauer;
- unterschiedliche Query Keys für zwei Organisationen;
- deterministische Normalisierung semantisch gleicher Queryparameter;
- Cache-Clear bei Organisationswechsel;
- Retry-Entscheidung für 401, 403, validierte 4xx, 5xx und Netzwerkfehler;
- unveränderte Funktionsfähigkeit einer noch nicht migrierten Route.

Führe danach passend zum tatsächlichen Diff aus:

- fokussierte Vitest-Tests;
- `npx tsc --noEmit`;
- gezieltes ESLint für geänderte Dateien, danach `npm run lint`;
- vollständige Vitest-Suite;
- `npm run build`;
- `git diff --check`.

Wenn ein Lauf wegen der lokalen Umgebung statt wegen des Codes scheitert, trenne beides eindeutig. Kompilierungszeit ist kein Nachweis einer Laufzeitverbesserung.

### Abschlussbericht

Berichte:

- was konkret hinzugefügt wurde;
- welche Dateien neu oder geändert sind;
- welche bestehenden Dateien mit Nutzeränderungen bewusst nicht angefasst wurden;
- welche Tenant-/Cache-Grenzen durch Tests belegt sind;
- alle ausgeführten Prüfungen mit Ergebnis;
- offene Risiken oder Annahmen;
- ausdrücklich: kein Deployment, Commit, Branch oder Reset.

Beende nach diesem Fundament. Starte den Lager-Pilot nicht im selben Auftrag.

