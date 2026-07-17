# StorageX Beta Release Report

Stand: 17. Juli 2026  
Entscheidung: **STORAGEX BETA READY: YES**

## Umfang

Das Release-Gate bewertet den Stand nach Prompt 0 bis 11. Es wurden keine neuen großen Fachmodule und keine Schema-Migration eingeführt. Während des Gates wurden ausschließlich releasekritische Korrekturen umgesetzt:

- konsistente Drill-down-Logik für niedrigen Eigenbestand;
- Schutz der App-Shell vor Dokument-Overflow bei breiten operativen Tabellen;
- vier zusätzliche read-only Integritätsprüfungen für Retourenbewegungen, Lieferantenretouren und wiederkehrende Ausgaben;
- serverseitige Pagination der Verkaufsansicht mit 25/50/100 Zeilen;
- Lazy-Mount der Verkaufsbearbeitung, damit geschlossene Formulare nicht für jede Tabellenzeile hydriert werden;
- korrigierte StorageX-Metadaten und bereinigte Hydration-Konsole.

## Release-Gates

| Gate | Ergebnis | Evidenz |
| --- | --- | --- |
| Prisma validate | Bestanden | Schema gültig |
| Prisma generate | Bestanden | Prisma Client 6.19.3 erzeugt |
| Migration status | Bestanden | 23 Migrationen, Datenbank aktuell |
| Typecheck | Bestanden | `npx tsc --noEmit` |
| Lint | Bestanden | `npm run lint` |
| Tests | Bestanden | 60 Dateien, 364 Tests |
| Integrity | Bestanden | 17 Prüfungen, jeweils 0 Verstöße |
| Production Build | Bestanden | Next.js 15.5.20, 37 statische Seiten erzeugt |
| Diff hygiene | Bestanden | `git diff --check` ohne Fehler |

Die Integritätsprüfung deckt insbesondere negative Bestände, inkonsistente Lot-Typen, Überallokationen, mehrfach verwendete Retourenbewegungen, falsche Bewegungslinks, versendete Lieferantenretouren ohne gültige Bewegung, Cross-Tenant-Links, doppelte Dokumentnummern, doppelte Recurrence-Vorkommen und Ledger-Replay-Abweichungen ab.

## Browser- und Dogfood-Ergebnis

Geprüft wurde mit einem isolierten password-only MEMBER-QA-Konto ohne 2FA. Das Konto besitzt ein eigenes Tenant-Dataset und ein aktives Konsignations-Entitlement.

| Viewport | Ergebnis |
| --- | --- |
| 1440 px | zentrale und administrative Routen ohne Dokument-Overflow, Console- oder Netzwerkfehler |
| 1280 px | Einkauf-Overflow gefunden und durch App-Shell-Begrenzung behoben; Tabelle scrollt intern |
| 768 px | Dashboard, Einkauf, Lager, Verkauf, Aufgaben, Retouren, Datenbereiche und Einstellungen stabil |
| 390 px | mobile Navigation, Kernmodule, Drawer, Filter und Tabellen ohne Dokument-Overflow |

Zusätzlich geprüft:

- mobile Navigation hält den Fokus im Dialog; Escape schließt und stellt den Fokus wieder her;
- Lager-Detail-Drawer verhält sich analog;
- `/zugangsdaten` weist MEMBER serverseitig ab;
- Import Center: Beispiel-XLSX, automatische Spaltenzuordnung, Dry Run, Commit und Historie;
- gefilterter CSV-Export enthält nur die importierte Testzeile;
- Inventory-Ledger ist für MEMBER exportierbar;
- Vollauszug ist für MEMBER mit HTTP 403 gesperrt;
- Verkaufsseite zeigt 50 Treffer je Seite, Folgeseiten und einen funktionsfähigen Lazy-Bearbeiten-Dialog;
- CDP-Trace: 1.196 Events auf Dashboard, Lager und Import Center, keine Runtime-/Console-/Netzwerkfehler, ausschließlich `localhost`.

## Performance

Gemessen wurde gegen einen lokalen optimierten Production-Build mit authentifizierter Sitzung.

| Seite | Lighthouse Performance | Accessibility | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Dashboard | 97 | 100 | 1,1 s | 1,4 s | 190 ms | 0 |
| Verkauf vor Optimierung | 35 | 94 | 5,1 s | 5,3 s | 4.114 ms | 0 |
| Verkauf nach Pagination/Lazy-Mount | 71 | 95 | 1,4 s | 1,7 s | 1.425 ms | 0 |

Die Verkaufs-Payload sank von rund 823 KB auf 147 KB. Die verbleibende Main-Thread-Last ist eine bekannte Beta-Limitation; sie blockiert die kontrollierte Beta nicht.

## Security-Ergebnis

- Tenant-Zugriffe laufen über `requireOrg` und `tenantDb`; die Datenbank setzt FORCE RLS ein.
- Rollenprüfungen liegen in Server Actions und API-Routen, nicht nur in der UI.
- Konsignationsmutationen sind serverseitig über das Feature-Entitlement geschützt.
- Vollauszug und DSGVO-Export benötigen OWNER; Secrets sind von Exporten ausgeschlossen.
- IDOR-relevante Objektzugriffe werden innerhalb des Tenant-Clients aufgelöst.
- Stripe-Webhooks sind signaturgeprüft und idempotent getestet.
- AuditLog wird an den zentralen Mutationsgrenzen verwendet.
- Rate Limiting und Upload-Härtung sind für eine kleine kontrollierte Beta ausreichend, aber vor horizontaler Skalierung beziehungsweise öffentlichen Uploads nachzuschärfen.

Details stehen in [security-release-checklist.md](security-release-checklist.md) und [beta-known-limitations.md](beta-known-limitations.md).

## Gate-Entscheidung

Es bestehen keine offenen P0-/P1-Fehler und keine bekannte Datenintegritätsverletzung. Die offenen P2-/P3-Punkte sind dokumentierte Betriebs- und Skalierungsgrenzen, keine verdeckten Funktionsausfälle. Die Beta ist für einen kontrollierten Nutzerkreis freigegeben.

**STORAGEX BETA READY: YES**
