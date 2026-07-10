# Public Site Map

Stand: 2026-07-10

## Zielstruktur

Die öffentliche Oberfläche soll als klare Produktpräsenz funktionieren:

- Landingpage als Single Page: `/`
- Login: `/login`
- Register: `/registrieren`
- Pricing-Anker auf Landingpage: `/#pricing`
- Kompatibilitätsroute Pricing: `/pricing`
- Impressum: `/impressum`
- Datenschutz: `/datenschutz`
- AGB/Terms: `/agb`
- Einladung: `/einladung/[token]`

Optional in späterer Phase:

- Kontakt: `/kontakt` oder eingebettet als Frage-/Chat-Element
- Status/Changelog: `/updates`, falls öffentlich gewünscht

## Landingpage als Single Page

### 1. Navigation

Links:

- `Workflow` -> `/#workflow`
- `Funktionen` -> `/#features`
- `Preise` -> `/#pricing`
- `FAQ` -> `/#faq`
- `Anmelden` -> `/login`
- Primär-CTA `Organisation gründen` -> `/registrieren`

Mobile:

- kompakter Header mit Logo, Login, CTA und optionalem Menü.
- keine überladene Navigation.

### 2. Hero

Route: `/`

Inhalt:

- Headline mit Produktversprechen.
- Subcopy mit Zielgruppe und Warenfluss.
- Primär-CTA: `Organisation gründen`
- Sekundär-CTA: `Workflow ansehen` oder `Preise ansehen`
- Hero-Visual: "Moving Ledger" als Prozess-/Ledger-Objekt.

Ziel:

Nutzer verstehen sofort: StorageX verbindet Ware, Verkauf, Retoure und Auszahlung.

### 3. Problem / Warum

Anker: `/#problem`

Inhalt:

- Tabellen verlieren Beziehungen zwischen Ware, Order, Retoure und Auszahlung.
- Mehrere Plattformen erzeugen verstreute Belege.
- Teams brauchen denselben Stand.

Keine überdramatische Pain-Copy. Besser operative Klarheit.

### 4. Workflow

Anker: `/#workflow`

Stationen:

1. Einkauf
2. Bestand
3. Verkauf
4. Retoure
5. Auszahlung

Für jede Station:

- was passiert
- welche Daten entstehen
- welche Folge automatisch aktualisiert wird

Retoure als Rückschleife im Diagramm darstellen.

### 5. Produktmodule / Use Cases

Anker: `/#features`

Gruppen:

- Bestand & Wareneingang
- Verkauf & Marge
- Retouren & Defekte
- Konsignation
- Schulden & Auszahlung
- Team & Sicherheit

Statt reiner Karten: Module als operative Ausschnitte mit kleinen Datenzeilen, Status und Prozessbezug.

### 6. Trust / Kontrollschicht

Anker: `/#trust`

Inhalt:

- Mandantentrennung
- Audit-Log
- 2FA
- DSGVO-Export
- serverseitige Berechnungen
- nachvollziehbare Bestandsbewegungen

Ziel:

Vertrauen über Kontrollierbarkeit, nicht über leere Claims.

### 7. Pricing

Anker: `/#pricing`

Inhalt:

- Free, Pro, Business aus `TIERS`
- kurze Entscheidungshilfe
- Feature-Matrix nur reduziert auf öffentliche Top-Fragen

Route `/pricing`:

- entweder als eigene Detailseite behalten
- oder auf `/#pricing` umleiten
- bestehende Query-Parameter für Feature-Gating beachten: `?feature=...&erforderlich=...`

### 8. About / Wer sind wir

Anker: `/#about`

Inhalt:

- Warum StorageX existiert.
- Für welche Händlerteams es gebaut ist.
- Fokus auf operative Realität statt Startup-Story.

Mögliche Copy-Richtung:

> Gebaut für Handel, der aus Excel herausgewachsen ist, aber noch kein Enterprise-ERP braucht.

### 9. FAQ / Frage-Element

Anker: `/#faq`

FAQ-Themen:

- Für wen ist StorageX gedacht?
- Kann ich kostenlos starten?
- Was passiert bei Retouren?
- Wie funktionieren Teams und Rollen?
- Was ist Konsignation?
- Welche rechtlichen Daten muss ich hinterlegen?
- Wie sicher sind Mandantendaten?

Frage-/Chat-Element:

- kleines "Noch unsicher?"-Panel
- zunächst mailto oder Kontaktlink
- später echter Chat möglich

### 10. Footer

Footer-Spalten:

Produkt:

- Workflow
- Funktionen
- Preise
- Login
- Registrieren

Ressourcen:

- FAQ
- Kontakt
- Updates optional

Rechtliches:

- Impressum
- Datenschutz
- AGB

Marke:

- Kurzbeschreibung
- Copyright
- optional Standort/Land

## Auth-Seiten-Struktur

### Login `/login`

Ziel:

Schneller Zugang für bestehende Nutzer, aber klar im StorageX-Kontext.

Struktur:

- Header-Link zurück zur Landingpage.
- Zwei-Spalten-Layout auf Desktop:
  - links Marken-/Workflow-Panel
  - rechts Login-Formular
- Mobile: Markenpanel komprimiert über Formular.
- Link zu Register sichtbar.
- Datenschutz/Impressum im unteren Bereich.

Inhalte:

- Titel: `Anmelden`
- Subcopy: `Zurück in euren Warenfluss.`
- Formular bleibt technisch aus `LoginForm`.
- 2FA-Zustand visuell als Sicherheitskontrollpunkt zeigen.

Links:

- `/` Startseite
- `/registrieren`
- `/datenschutz`

### Register `/registrieren`

Ziel:

Neue Organisation anlegen, ohne wie ein generischer Signup zu wirken.

Struktur:

- gleicher Auth-Shell wie Login.
- Register-Formular in klaren Gruppen:
  - Person
  - Organisation
  - Rechtliches/Billing später
- Link zu Login sichtbar.
- Link zurück zur Landingpage.

Inhalte:

- Titel: `Organisation gründen`
- Subcopy: `Erstellt euren ersten gemeinsamen Handelsstand.`
- Formular bleibt technisch aus `RegisterForm`, wird visuell neu gerahmt.

Links:

- `/`
- `/login`
- `/datenschutz`
- `/agb`

### Einladung `/einladung/[token]`

Soll gestalterisch zur Auth-Shell passen:

- "Einladung annehmen"
- Organisation/Einladender sichtbar, falls Daten verfügbar.
- Login/Register-Pfade klar.

## Legal-Seiten

### Impressum `/impressum`

Pflichtangaben:

- Anbieter
- Vertretungsberechtigte Person
- Anschrift
- Kontakt
- USt-ID, falls vorhanden
- Verantwortlich nach § 18 Abs. 2 MStV, falls nötig

Hinweis: Inhalte müssen vom Betreiber geliefert oder juristisch geprüft werden.

### Datenschutz `/datenschutz`

Struktur:

- Verantwortlicher
- Hosting
- Authentifizierung
- Zahlungsanbieter/Stripe
- E-Mail/SMTP
- Cookies/Session
- Rechte der Betroffenen
- Aufbewahrung/Löschung
- Kontakt

### AGB `/agb`

Struktur:

- Leistungsbeschreibung
- Nutzerkonto/Organisation
- Abos und Zahlung
- Verfügbarkeit
- Pflichten des Kunden
- Haftung
- Kündigung
- Schlussbestimmungen

## Routing-Konzept

### Primäre Pfade

- `/` ist die zentrale öffentliche Produktseite.
- `/login` und `/registrieren` sind dedizierte Auth-Routen.
- `/pricing` bleibt mindestens während Migration bestehen.
- Legal-Routes sind im Footer von allen Public- und Auth-Seiten erreichbar.

### CTA-Konzept

Landingpage:

- primär: `/registrieren`
- sekundär: `/#workflow` oder `/#pricing`

Pricing:

- Free -> `/registrieren`
- Pro/Business -> bestehender Checkout-Flow, aber unauthentifizierten Zustand prüfen.

Auth:

- Login -> Register
- Register -> Login
- beide -> Landingpage

### Redirects/Kompatibilität

Bestehende Links zu `/pricing` nicht brechen.

Optionen:

1. `/pricing` als separate Detailseite behalten, aber visuell anpassen.
2. `/pricing` serverseitig auf `/#pricing` redirecten, wenn Query-Parameter nicht benötigt werden.
3. `/pricing` als "Plan wählen"-Detailseite für Feature-Gating behalten und aus Landingpage dorthin verlinken.

Empfehlung:

Option 3. Landingpage enthält Pricing-Preview, `/pricing` bleibt für Feature-Gating und Detailvergleich.

## Nächste Implementierungsphase

1. Public Layout/Shell für Landing, Pricing, Legal und Auth definieren.
2. Landingpage neu komponieren.
3. Auth-Shell für Login/Register/Einladung bauen.
4. Legal-Seiten als Routen anlegen.
5. Pricing in Landing integrieren und `/pricing` visuell angleichen.
6. Browserprüfung mit `chrome-devtools`/`browser-trace` nach Codex-Neustart.
