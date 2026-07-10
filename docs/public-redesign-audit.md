# Public Redesign Audit

Stand: 2026-07-10

## Scope

Dieser Audit betrachtet die öffentliche Produktoberfläche von StorageX:

- Landingpage: `/`
- Pricing: `/pricing`
- Login: `/login`
- Registrierung: `/registrieren`
- Einladung: `/einladung/[token]` als angrenzender Auth-Flow
- öffentlicher Header/Footer über `components/marketing/marketing-shell.tsx`

Die installierten MCPs (`chrome-devtools`, `next-devtools`, `codebase-memory-mcp`) sind in der laufenden Codex-Session noch nicht als Tools verfügbar. Der Befund basiert deshalb auf Code-, Routen- und Komponentenprüfung. Eine Browser-Prüfung sollte in der Umsetzungsphase nach Session-Neustart folgen.

## Aktueller Zustand

### Landingpage

Die Landingpage in `app/page.tsx` ist eine kurze Marketingseite mit:

- sticky Marketing-Navigation
- Hero mit Claim, Subcopy, zwei CTAs
- SVG-Routenlinie `Einkauf -> Lager -> Verkauf -> Auszahlung`
- drei Statistikwerte
- Feature-Karten für Lager, Verkauf, Steuer, Retouren, Team
- Social-Proof-Platzhalter
- Abschluss-CTA
- Footer

Die Produktlogik ist bereits angelegt: Warenfluss, Handels-GbRs, Plattformen, Steuer, Retouren, Team. Visuell bleibt die Seite aber nahe an einem Standard-SaaS-Muster aus Hero, Stats, Cards, Testimonials, CTA.

### Pricing

`app/pricing/page.tsx` ist eine eigene öffentliche Seite mit drei Tiers und Feature-Vergleich. Sie nutzt dieselbe Marketing-Navigation und Footer-Struktur, wirkt funktional, aber separiert von der Landingpage. Der Nutzer springt aus der Landingpage zu `/pricing`, statt eine zusammenhängende Produktgeschichte zu erleben.

### Login

`app/(auth)/login/page.tsx` ist ein zentrierter Card-Dialog mit Titel, Beschreibung, Formular und Link zur Registrierung. Es gibt keinen sichtbaren Link zurück zur Landingpage, keine Markenfläche und keine Produktkontext-Erinnerung. Der Login wirkt wie ein generischer shadcn/Auth-Screen.

### Register

`app/(auth)/registrieren/page.tsx` ist ebenfalls ein zentrierter Card-Dialog. Der Flow ist funktional: Konto, Organisation, Rechtsform, USt-ID. Er hat einen Wechsel zurück zu Login, aber keinen starken Bezug zur Landingpage oder zur Produktidee. Der Sonderfall `orgOnly` ist logisch sauber, aber visuell nicht als eigener Zustand gestaltet.

### Footer

`MarketingFooter` enthält nur Marke, Kurzlabel und Links zu Pricing/Login/Register. Es fehlen rechtliche Seiten und eine strukturierte öffentliche Informationsarchitektur. Der Footer wirkt wie ein Platzhalter, nicht wie ein Produkt-Footer.

### Öffentliche/legale Seiten

Aktuell existieren keine erkennbaren öffentlichen Routen für:

- `/impressum`
- `/datenschutz`
- `/agb` oder `/terms`
- `/kontakt`
- `/about`
- `/faq`

Für eine deutsche SaaS-Präsenz sind Impressum und Datenschutz praktisch Pflichtbestandteile. AGB/Terms sind je nach Geschäftsmodell sinnvoll, besonders bei Subscription/Billing.

## Designprobleme

### 1. Standard-SaaS-Komposition

Die Seitenstruktur folgt einem sehr bekannten Muster:

1. centered Hero
2. Icons plus Feature Cards
3. Statistikband
4. Testimonials
5. CTA

Das ist verständlich, aber nicht einprägsam. Es erzählt StorageX nicht als operatives Handelsprodukt, sondern als "noch eine SaaS-App".

### 2. Zu viel generische Kartenlogik

Feature-Karten, Pricing-Karten und Testimonial-Karten nutzen alle ähnliche Card-Sprache. Es entsteht keine eigene Formensprache aus der Produktlogik. Karten sind hier Container, aber kein Markenmerkmal.

### 3. Hero-Idee bleibt zu diagrammatisch

Die Routenlinie ist der stärkste existierende Ansatz. Sie transportiert den Warenfluss, bleibt aber als einfache SVG-Linie mit Icons eher erklärend als markenbildend. Sie wirkt wie ein Diagramm, nicht wie ein visuelles Produktobjekt.

### 4. Copy hat gute Fachbegriffe, aber wenig eigenständige Tonalität

Begriffe wie Handels-GbR, Wareneingang, Marge, Retouren, Steuer-Automatik sind richtig. Gleichzeitig sind Claims wie "Alles im Griff", "Kostenlos starten" und "Bereit für den nächsten Wareneingang?" stark generisch.

### 5. Öffentliche Oberfläche und App-Produkt wirken getrennt

Die interne App hat eine operative, tabellarische, workflowbasierte Oberfläche. Die Landingpage zeigt aber kaum echte Workflow-Tiefe, Prozesszustände, Belege, Kontrollpunkte oder operative Präzision. Dadurch entsteht ein Bruch zwischen Versprechen und Produktrealität.

### 6. Auth-Seiten sind nicht markenfähig

Login und Register könnten jeder B2B-App gehören. Sie nutzen keine gemeinsame visuelle Sprache mit Landingpage/Pricing außer Tokens und Card-Styling. Es fehlen:

- Rückweg zur Landingpage
- Wechsel Login/Register prominent und ruhig
- Marken-/Workflow-Seitenpanel
- Trust- oder Sicherheits-Hinweise
- Produktkontext für neue Nutzer

### 7. Pricing ist zu isoliert

Pricing ist als Seite vorhanden, aber die Zielanforderung möchte Pricing in der Landingpage-Single-Page. Aktuell ist Pricing ein separates Ziel und wird im Footer/Nav verlinkt. Dadurch fehlt ein linearer öffentlicher Funnel.

### 8. AI-/Template-Signale

Nicht durch offensichtliche Neon-/AI-Optik, sondern durch Muster:

- Icon + Card + kurze Feature-Texte
- generische Testimonials als "Beispiel-Zitat"
- universelle CTA-Wording
- centered Hero ohne starke visuelle Welt
- dezente Reveal-Animationen ohne produktbezogene Bewegung

## UX-Probleme

### Navigation

- Landingpage führt zu Register und Pricing, aber nicht zu Login als gleichwertigem Ziel im Hero.
- Login/Register führen nicht sichtbar zurück zur Landingpage.
- Register/Login-Wechsel existiert, aber nur unterhalb der Form.
- Pricing-CTA für bezahlte Tiers nutzt Checkout-Action; für unauthentifizierte Nutzer muss geprüft werden, ob der Flow sauber zu Auth führt.

### Informationsarchitektur

- About fehlt, obwohl ein operatives Handelsprodukt Vertrauen braucht.
- FAQ oder Trust-Sektion fehlt.
- Legal-Links fehlen.
- Kontakt/Frage/Chat-Element fehlt.
- Pricing ist getrennt statt Teil der Single-Page-Story.

### Vertrauen

- Testimonials sind explizit Platzhalter und sollten entfernt oder durch glaubwürdige Trust-Mechaniken ersetzt werden.
- Es fehlen konkrete Sicherheits- und Compliance-Signale auf Public-Seiten, obwohl App-Funktionen wie 2FA, Audit-Log, AES-256, DSGVO-Export vorhanden sind.
- Mandantentrennung/RLS wird als Statistik genannt, aber nicht verständlich erklärt.

### Auth-Ergonomie

- Login hat 2FA-Feld erst nach Fehlerzustand. Funktional okay, visuell aber nicht als Sicherheitsfeature inszeniert.
- Register ist lang, weil Account + Organisation in einem Formular liegen. Es braucht bessere visuelle Gruppierung.
- Auth-Seiten haben keine "Warum bin ich hier?"-Orientierung.

## Fehlende Seiten und Routen

Mindestumfang für saubere öffentliche Präsenz:

- `/impressum`
- `/datenschutz`
- `/agb` oder `/terms`
- optional `/kontakt`

In der Zielstruktur kann Pricing auf der Landingpage liegen, aber `/pricing` sollte aus Kompatibilitätsgründen entweder weiter bestehen oder auf `/#pricing` verweisen.

## Technische Relevanz

### Bestehende Bausteine, die wiederverwendbar sind

- `MarketingNav` und `MarketingFooter` als Ausgangspunkt, aber nicht final.
- `RouteLine` als konzeptioneller Kern, sollte aber neu interpretiert werden.
- Design Tokens in `app/globals.css`: `ink`, `fog`, `slate`, `cargo-amber`, `transit-teal`, `customs-red`.
- Fonts: Inter, Space Grotesk, JetBrains Mono.
- `PricingTiers` und `TIERS` als Daten-/Billing-Basis.
- Auth-Formulare sind funktional und sollten nicht neu erfunden, sondern neu gerahmt werden.

### Teile, die komplett neu gebaut werden sollten

- Landingpage-Komposition: neu strukturieren, nicht nur stylen.
- Hero: neues Markenobjekt statt einfacher centered Hero.
- Public Footer: neu als Rechts-/Produkt-/Kontaktstruktur.
- Auth Page Shell: gemeinsame Marken-/Workflow-Hülle für Login und Register.
- Testimonials: entfernen oder durch echten Trust/FAQ/Operational Proof ersetzen.

### Teile, die eher refactored werden sollten

- `MarketingNav`: zu einer Public-Navigation mit Anchor-Links und Auth-Links ausbauen.
- `PricingTiers`: in Landingpage einbettbar machen.
- `RouteLine`: als Baustein für neue Prozessvisualisierung oder 3D-Idee nutzen.

## Zusammenfassung der Schwächen

Die aktuelle Oberfläche ist funktional und sauber, aber nicht eigenständig. StorageX hat bereits ein starkes narratives Material: Warenfluss, Kontrollpunkte, Bestandsbewegungen, Retouren, Auszahlung, Mandantentrennung. Die öffentliche UI übersetzt das noch nicht in eine starke visuelle Identität. Der nächste Schritt sollte nicht Kosmetik sein, sondern eine neue visuelle Grammatik rund um operative Warenbewegung.
