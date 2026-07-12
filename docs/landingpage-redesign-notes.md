# Landingpage Redesign Notes

Stand: 2026-07-12

## Designidee: Transit Ledger Control Board

Die Landingpage übersetzt die Produktlogik in ein physisches, operatives Bild: eine Warenbahn mit Kontrollpunkten, Ledger-Zetteln, Statusstempeln und einer sichtbaren Retouren-Rückspur. Das Hero-Objekt ist kein dekoratives SaaS-Motiv, sondern eine pseudo-isometrische Darstellung des Kernmodells `Einkauf → Bestand → Verkauf → Retoure → Auszahlung`.

Die visuelle Sprache arbeitet mit dem vorhandenen StorageX-System aus Ink, Paper, Transit Teal, Cargo Amber und Customs Red. Dunkle Abschnitte wirken wie ein Leitstand; helle Abschnitte wie Manifest, Beleg oder Prüfliste. Monospace-Metadaten, dünne Rails und operative Zustände ersetzen generische Feature-Illustrationen.

## Hauptsektionen

1. Hero mit isometrischem Transit-Ledger-Board, Prozessstationen, Tickets und animierter Warenbewegung.
2. Problemvergleich zwischen fragmentierter Tabellenarbeit und einer zusammenhängenden Warenhistorie.
3. Workflow als fünf Kontrollpunkte mit eigener Retouren-Rückspur.
4. Kontextualisierte Use Cases für Eigenbestand, Konsignation, Retouren/Defekte und Team/Kontrolle.
5. Vertrauens- und Kontrollschicht für Mandantentrennung, Audit-Log, 2FA und DSGVO-Export.
6. Kompakte Pricing-Sektion auf Basis der zentralen `TIERS`-Konfiguration.
7. About-/Manifest-Sektion mit den Produktprinzipien hinter StorageX.
8. Integrierte Fragekonsole als ehrlicher UI-Platzhalter für einen späteren Kontaktkanal.
9. FAQ mit nativen, tastaturbedienbaren `details`-/`summary`-Elementen.
10. Abschluss-CTA und vorhandener Public Footer.

## Motion-Ansatz

- Das Hero-Board setzt sich einmalig mit einer kurzen räumlichen Bewegung.
- Die Warenbahn zeichnet sich kontrolliert auf; anschließend fährt ein einzelner Signalpunkt mit langer Pause durch die Stationen.
- Der bestehende IntersectionObserver-Reveal wird für Section- und Element-Eintritte wiederverwendet.
- FAQ-Pfeile, Buttons und Fokuszustände reagieren über kurze, gezielte Übergänge.
- Bewegungen verwenden überwiegend `transform` und `opacity`.
- `prefers-reduced-motion` deaktiviert Board-, Route- und Puls-Animation vollständig und reduziert Reveals auf Opacity.

## Besondere UI- und Visual-Elemente

- Isometrisches Ledger-Board mit fünf Stationen, Return Loop und verbuchten Tickets.
- Tabellenvergleich, der Beziehungen statt erfundener Erfolgsmetriken zeigt.
- Use-Case-Zeilen mit operativen Statusfeldern statt gleichförmiger Feature Cards.
- Pricing als technische Planblätter mit klaren Tarifgrenzen.
- About-Manifest mit vier konkreten Produktprinzipien.
- Fragekonsole, die ausdrücklich keine Daten sendet oder speichert, bis ein echter Kontaktkanal angebunden ist.

## Produktionsentscheidungen

- Shadcn-Buttons bleiben die zentrale Interaktionsprimitive.
- Lucide bleibt als einziges Icon-System bestehen; die Kernbegriffe wurden mit Better Icons gegen den Lucide/Iconify-Katalog geprüft.
- Pricing-Daten werden nicht dupliziert, sondern direkt aus `lib/billing.ts` gelesen.
- Es wurden keine Testimonials, Kundenzahlen, Logos oder Uptime-Angaben erfunden.
- Es wurde keine externe 3D- oder Motion-Library ergänzt; die Darstellung bleibt CSS-basiert und leichtgewichtig.

## Bekannte spätere Verbesserungen

- Die Fragekonsole benötigt später einen echten, datenschutzgeprüften Kontakt- oder Support-Endpunkt.
- Echte Produkt-Screens oder verifizierte Kundenzitate könnten nach Bereitstellung ergänzt werden.
- Eine weiterführende Motion-Phase könnte die Warenbewegung an Scroll-Fortschritt koppeln, sollte aber vorher gegen Performance und Reduced Motion getestet werden.
- Das Next.js Runtime-MCP von `next-devtools` steht in diesem Projekt mit Next.js 15.5.20 nicht zur Verfügung; ein Framework-Upgrade war nicht Teil von Prompt C.
- Der Browser-Trace-Wrapper kann unter Windows den globalen npm-`browse.cmd`-Shim nicht direkt spawnen. Für Prompt C wurde deshalb der zugrunde liegende read-only CDP-Firehose direkt verwendet und anschließend sauber beendet.
- Der abschließende netzwerkfähige Production Build konnte in der aktuellen Session wegen des Plattform-Nutzungslimits nicht ausgeführt werden. Der Sandbox-Build scheitert ausschließlich an den drei bereits bestehenden `next/font`-Google-Font-Abrufen; TypeScript, ESLint und Tests sind grün.
