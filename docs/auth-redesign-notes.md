# Auth Redesign Notes

## Designidee

Login und Registrierung werden als **Transit Gate** inszeniert: nicht als isolierte Standardformulare, sondern als kontrollierter Einstieg in denselben operativen Warenfluss, den die Landingpage erklärt. Die linke Seite zeigt eine dunkle Leitstellenfläche mit Bewegungslinie und Kontrollpunkt. Die rechte Seite funktioniert wie ein helles Zugangsmanifest mit klarer Feldhierarchie.

Die Komposition übernimmt bewusst die prägnanten Elemente der Landingpage:

- operative statt dekorativer Bildsprache
- Transit-Teal, warmes Papier, technische Linien und Monospace-Metadaten
- eine durchgängige Route von Einkauf bis Auszahlung
- asymmetrische Editorial-Typografie statt einer zentrierten Auth-Karte

## Gemeinsame UX-Sprache

Beide Routen verwenden weiterhin `PublicAuthShell`, jetzt mit den Varianten `login` und `register`. Dadurch teilen sie Layout, Produktkontext, rechtliche Links, Rückweg zur Landingpage, responsive Regeln und Motion, während Text und Kontrollpunkt die jeweilige Aufgabe klar unterscheiden.

Die vier notwendigen Wege sind sichtbar in die gemeinsame Shell eingebaut:

- Login → Landingpage
- Register → Landingpage
- Login → Register
- Register → Login

## Formularführung

### Login

- E-Mail und Passwort bleiben im vorhandenen NextAuth-Credentials-Flow.
- Generische Credentials-, 2FA-erforderlich- und 2FA-ungültig-Zustände bleiben erhalten.
- Fehler sind als Live-Alert mit den betroffenen Feldern verknüpft.
- Das 2FA-Feld erscheint weiterhin nur bei Bedarf und wird dann als Kontrollschritt hervorgehoben.
- Autofill-, Fokus- und Touch-Zustände sind explizit gestaltet.

### Registrierung

- Konto und Organisation sind als nummerierte, semantische Fieldsets strukturiert.
- Die bestehende Server Action, Zod-Validierung, 12-Zeichen-Regel und OWNER-Zuweisung bleiben unverändert.
- Der Sonderfall eines angemeldeten Nutzers ohne Organisation verwendet dieselbe Sprache, zeigt aber nur das Organisationsmanifest.

## Visuelle Elemente

- produktbezogene Fünf-Stationen-Route statt abstrakter Illustration
- route-spezifische Gate-Codes (`RETURN` und `ORIGIN`)
- Kontrollpunkt mit Fingerprint bzw. Schlüssel
- kleine Trust-Tags für 2FA, Auditierbarkeit und Mandantentrennung
- Papierkante und Manifest-Metadaten als Verbindung zur Ledger-Idee

Die Icons stammen konsistent aus Lucide und wurden mit Better Icons gegen die gewählte lineare Sprache geprüft (`scan-line`, `shield-check`, `key-round`, `fingerprint`). shadcn-Primitives bleiben die Basis für Buttons, Inputs, Labels und Alerts.

## Motion

Nur die Route besitzt eine langsame, kontrollierte Scan-Bewegung. Button- und Link-Icons reagieren kurz auf Hover. Alle Animationen arbeiten ausschließlich mit Transform/Opacity und werden über `prefers-reduced-motion` deaktiviert.

## Responsive Verhalten

- Desktop: echte asymmetrische Split-Komposition mit zusammenhängender Kante.
- Tablet: Produktkontext und Manifest werden als zusammenhängendes vertikales Objekt gestapelt.
- Mobile: kompakter Produktkontext, vollständige Route und anschließend das Formular; sekundäre Trust-Details werden zugunsten der Aufgabe reduziert.
- Landingpage-Link, Auth-Wechsel und rechtliche Links bleiben in allen Größen sichtbar.

## Technische Grenzen und spätere Verbesserungen

- Context7 und codebase-memory-mcp waren in dieser Session nicht als aufrufbare Tools verfügbar. Die Umsetzung basiert deshalb auf direkter Codebase-Analyse und den bestehenden Prompt-A-bis-C-Dokumenten.
- Das Projekt verwendet Next.js 15.5.20. Falls next-devtools keinen Runtime-MCP-Endpunkt findet, ist das die bekannte Next.js-15-Kompatibilitätsgrenze und kein Routingfehler.
- Passwort-zurücksetzen und Social Login sind keine bestehenden Produktflüsse und wurden nicht erfunden.
- Eine spätere Erweiterung könnte Passwortstärke lokal visualisieren, sobald dafür ein verbindlicher Produkt- und Sicherheitsvertrag definiert ist.

## Validierung

- Desktop, Tablet (768 px) und Mobile (390 px) geprüft; kein horizontaler Overflow.
- Dark- und Light-Darstellung geprüft.
- Login-Fehler, Pflichtfelder und 12-Zeichen-Passwortregel im echten Browser geprüft.
- Alle vier geforderten Navigationswege geprüft.
- Keine Console-, Hydration-, Request- oder Asset-Fehler auf Login und Register.
- Lighthouse Accessibility: Login 100, Register 100; Best Practices jeweils 100.
- Grober Login-Performance-Trace ohne Throttling: LCP 782 ms, CLS 0.00.
- Browser Trace konnte wegen verweigerter Windows-Prozessabfrage im Sandbox-Kontext nicht initialisiert werden; nach einem Versuch wurde nicht weiter retried. Chrome DevTools lieferte die vollständige CDP-, Netzwerk-, Console- und Performance-Evidenz.
