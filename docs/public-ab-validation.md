# Public A/B Validation

Stand: 2026-07-10

## Ausgangszustand

Prompt A und Prompt B waren als zwei getrennte Commits vorhanden:

- `de5090c` dokumentiert Audit, Designrichtung und Site Map.
- `3587119` implementiert die Public Shell, Auth Shell sowie About- und Legal-Routen.

Der Worktree war vor Beginn der Recovery-Pruefung sauber. Prompt B ist bewusst ein Fundament: Die vollstaendige Landingpage, Pricing-Integration, FAQ-/Trust-/Chat-Elemente, finale Motion und das vollstaendige Auth-Redesign gehoeren zu spaeteren Prompts und wurden in dieser Phase nicht begonnen.

Die App verwendet Next.js 15.5.20. `chrome-devtools` und `next-devtools` waren in der Session als MCP-Tools registriert, ihre Aufrufe wurden jedoch vor Tool-Ausfuehrung durch das Session-Kontingent blockiert. `codebase-memory-mcp` war in dieser Session nicht als aufrufbares Tool verfuegbar.

## Gefundene Routing-Probleme

- Die neuen Routen `/about`, `/impressum`, `/datenschutz` und `/agb` fehlten in `middleware.ts` in der Liste der oeffentlichen Routen.
- Nicht angemeldete Besucher wurden dadurch von allen vier verlinkten Public-/Legal-Seiten auf `/login` umgeleitet.
- Die statische App-Router-Struktur fuer Landingpage, Pricing, Login, Registrierung, About und Legal-Seiten ist ansonsten vorhanden und konsistent.
- Login und Registrierung verwenden die gemeinsame `PublicAuthShell` direkt. Ein zusaetzliches `app/(auth)/layout.tsx` ist fuer die dokumentierte Struktur nicht erforderlich.

## Gefundene UI-Probleme

- Der Login-Link im Public Header war unterhalb von 640 px vollstaendig ausgeblendet.
- Das widersprach der dokumentierten Mobile-Navigation aus `docs/public-site-map.md`, die Logo, Login und Registrierungs-CTA vorsieht.
- Die oeffentliche Shell verwendet konsistent lineare Lucide-Icons. Es wurden keine gemischten Icon-Bibliotheken oder offensichtlich dekorativen Ersatz-Icons gefunden.
- Die vorhandene Landingpage traegt weiterhin die in Prompt A dokumentierten generischen SaaS-Muster. Das ist kein Prompt-B-Regressionsfehler, weil deren vollstaendiger Ersatz ausdruecklich Prompt C vorbehalten ist.

## Gefundene Runtime-Probleme

- Der Next.js-15-Dev-Server startete auf Port 3000 und kompilierte Middleware und geaenderte Komponenten ohne Fehler.
- Ein `next-devtools`-Runtime-Index konnte nicht ausgefuehrt werden: Die Plattform blockierte den Aufruf wegen des Session-Kontingents vor Erreichen des MCP-Servers.
- Die vorgeschriebene Browserpruefung von Console, Network, Hydration, 404s und Assets konnte aus demselben Grund nicht mit `chrome-devtools` ausgefuehrt werden.
- Der Production Build erreichte die optimierte Kompilierung, scheiterte in der Sandbox aber an blockierten Downloads fuer Inter, Space Grotesk und JetBrains Mono von Google Fonts.
- Der angeforderte Wiederholungslauf mit Netzwerkfreigabe wurde ebenfalls vor Ausfuehrung durch das Session-Kontingent blockiert.

## Gefundene Accessibility-Probleme

- Der reparierte mobile Login ist als Icon-Aktion sichtbar und besitzt den zugaenglichen Namen `Anmelden`; das Icon selbst ist dekorativ markiert.
- Formularfelder in Login und Registrierung besitzen explizite Labels und passende Autocomplete-Attribute.
- Globale `:focus-visible`-Stile und benannte Public-Navigationen sind vorhanden.
- Ein Lighthouse Accessibility Audit konnte wegen der blockierten `chrome-devtools`-Ausfuehrung nicht abgeschlossen werden. Kontrast, Fokusreihenfolge und gerenderte Semantik sind daher noch nicht browserseitig abschliessend belegt.

## Reparierte Probleme

- `/about`, `/impressum`, `/datenschutz` und `/agb` wurden in `middleware.ts` als oeffentliche Routen freigegeben.
- Der Login bleibt im Mobile Header als kompakte, beschriftete Icon-Aktion erreichbar.
- Der Registrierungs-CTA verwendet auf kleinen Viewports die kurze sichtbare Beschriftung `Starten`, behaelt ab `sm` aber die dokumentierte Beschriftung `Organisation gruenden`.
- Die Transit-Ledger-Typografiezeile wird auf kleinen Viewports ausgeblendet, um den Header ohne inhaltlichen Verlust zu entlasten.

## Bewusst nicht geaendert

- Kein neuer Hero und keine vollstaendige Landingpage-Erzaehlung aus Prompt C.
- Keine neue Pricing-Sektion, grossen Use-Case-Sektionen, FAQ-/Chat-Loesung, 3D-Szene oder grossen Motion-Sequenzen.
- Kein vollstaendiges Auth-Redesign aus Prompt D.
- Keine erfundenen Anbieter-, Datenschutz- oder AGB-Inhalte.
- Kein Framework-Upgrade auf Next.js 16 nur zur Aktivierung des Runtime-MCP-Endpunkts.
- Keine Umgestaltung der vorhandenen Landingpage-Muster, die bereits als spaeterer Prompt-C-Scope dokumentiert sind.

## Browser- und Responsive-Validierung (2026-07-12)

- Lokaler Next.js-15.5.20-Dev-Server auf Port 3002 ueber Chrome DevTools geprueft.
- `/`, `/pricing`, `/about`, `/impressum`, `/datenschutz`, `/agb`, `/login` und `/registrieren` liefern anonym die erwarteten Inhalte und HTTP 200. Die Reparatur der Public-Route-Klassifizierung ist damit browserseitig belegt.
- Bei 1440, 1280, 768 und 390 px keine horizontale Ueberlaufe. Die Desktop-Navigation kollabiert am Tablet-Breakpoint; Login und Registrierungs-CTA bleiben auf 390 px erreichbar.
- Keine Console-Fehler, Hydration-Warnungen, fehlgeschlagenen Requests, 404s oder fehlenden Assets beobachtet. Erwartete Turbopack-Fast-Refresh-Logs sind die einzigen Console-Eintraege.
- Visuelle Chrome-Screenshots bei 1440 und 390 px bestaetigen lesbare Header-, Hero-, CTA- und Workflow-Darstellung. Das noch generische Landingpage-Muster bleibt absichtlich Prompt-C-Scope.

## Lighthouse und Production Build (2026-07-12)

- Lighthouse Accessibility: **100/100** auf Desktop und im Mobile-Profil; Best Practices ebenfalls **100/100**. SEO liegt bei 91/100. Die verbleibenden Hinweise betreffen `robots.txt` und `llms.txt`, nicht die Accessibility oder die Prompt-A/B-Oberflaeche.
- Das Lighthouse-Tool meldete im Mobile-Profil weiterhin den zuvor emulierten Desktop-Viewport. Deshalb ist die Lighthouse-Accessibility-Bewertung als Mobile-Profil, nicht als zusaetzlicher echter 390-px-Viewport-Beleg, zu lesen. Die echte 390-px-Interaktions- und Overflow-Pruefung erfolgte zuvor direkt per Chrome-Emulation.
- `npm run build` lief mit freigegebenem Netzwerk erfolgreich bis zum Abschluss durch. Die zuvor blockierten Google-Font-Abrufe sind damit nicht mehr offen.

## Bereitschaft fuer Prompt C

Der statische Prompt-B-Stand ist nach den zwei Reparaturen konsistent. TypeScript-Typecheck, ESLint und alle 117 Vitest-Tests sind erfolgreich.

Die verpflichtende reale Browserpruefung, Lighthouse-Accessibility und der Production Build sind abgeschlossen. `next-devtools` bleibt aufgrund der Next.js-15-Beschraenkung nicht verfuegbar; ein Framework-Upgrade dafuer waere out of scope. Nach dem finalen Commit ist Prompt C freigegeben, ohne dass dessen Umsetzung in dieser Phase begonnen wurde.

Aktueller Gate-Status: **PROMPT A/B VALIDATION COMPLETE: YES**
