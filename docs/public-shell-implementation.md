# Public Shell Implementation

Stand: 2026-07-10

## Umfang dieser Phase

Diese Phase setzt das Fundament aus `docs/public-design-direction.md` um, ohne die finale Landingpage oder den finalen Auth-Redesign-Flow vollständig neu zu bauen.

Umgesetzt wurden:

- Public-Design-Tokens für Paper, Rail, Stamp und Mint Signal.
- Gemeinsame Public-Shell für Marketing-, Legal- und About-Seiten.
- Neuer Public-Header mit Brand-Mark, Section-Links, Login und Register-CTA.
- Neuer Public-Footer mit Produkt-, Vertrauens- und Legal-Struktur.
- Grundrouten für `/about`, `/impressum`, `/datenschutz` und `/agb`.
- Auth-Shell für `/login` und `/registrieren` mit Rückweg zur Landingpage und Wechselpfad.
- Anchor-Grundlage auf der Landingpage für `/#workflow`, `/#features` und `/#pricing`.

## Designsystem

Die Public-Oberfläche nutzt die bestehende StoargeX-Palette weiter, erweitert sie aber um die in Prompt A definierte Transit-Ledger-Sprache:

- `--paper`: warmer Beleg-/Papiergrund.
- `--rail`: technische Linien, Track- und Rasterdetails.
- `--stamp`: Stempel-, Label- und Ledger-Metadaten.
- `--mint-signal`: ruhige Erfolgs- und Kontrollflächen.

Zusätzliche Utility-Klassen:

- `.public-shell` für den öffentlichen Hintergrund mit subtiler Ledger-/Track-Struktur.
- `.public-container` für konsistente Public-Breiten.
- `.public-track-card` für operative Kartenflächen.
- `.public-ledger-panel` für Prozess-/Auth-/Legal-Flächen.
- `.public-section-kicker` und `.public-metadata` für monospaced Labels.
- `.public-legal-prose` für lesbare Legal-Seiten.

## Public Shell

`components/marketing/marketing-shell.tsx` enthält jetzt die zentralen Public-Module:

- `MarketingNav`
- `MarketingFooter`
- `PublicShell`
- `PublicPageHeader`
- `PublicAuthShell`
- `PlaceholderNotice`

Die bestehenden Exporte `MarketingNav` und `MarketingFooter` bleiben erhalten, damit Landingpage und Pricing kompatibel bleiben.

## Routing und Navigation

Aktive öffentliche Routen:

- `/`
- `/pricing`
- `/login`
- `/registrieren`
- `/about`
- `/impressum`
- `/datenschutz`
- `/agb`

Navigation:

- Header: `/#workflow`, `/#features`, `/#pricing`, `/about`, `/login`, `/registrieren`
- Footer: Produktlinks, About/Kontakt, Planvergleich, Impressum, Datenschutz, AGB
- Login: Link zurück zur Startseite, Link zur Registrierung, Legal-Links
- Register: Link zurück zur Startseite, Link zum Login, Legal-Links

## Legal-Seiten

Die Legal-Seiten enthalten bewusst keine erfundenen finalen Rechtstexte. Sie stellen nur Struktur und Platzhalter bereit:

- Anbieterangaben für Impressum.
- Datenschutzstruktur für Hosting, Auth, Zahlung, E-Mail, Cookies und Betroffenenrechte.
- AGB-Struktur für Leistung, Konto, Abos, Pflichten, Verfügbarkeit, Haftung und Schlussbestimmungen.

Vor produktiver Veröffentlichung müssen die Inhalte vom Betreiber ergänzt und juristisch geprüft werden.

## Grenzen dieser Phase

- Die Landingpage ist noch nicht vollständig neu komponiert.
- Pricing ist weiterhin eine Detailseite und nur als Anchor-Einstieg auf der Landingpage markiert.
- FAQ-/Trust-/Chat-Sektionen sind noch nicht final gebaut.
- Browser-/MCP-Prüfung konnte in dieser Session nicht über die genannten MCP-Tools erfolgen, weil sie im Tool-Index nicht verfügbar waren.

## Empfohlene nächste Phase

1. Landingpage als vollständige Single-Page-Erzählung neu komponieren.
2. Pricing-Preview aus `TIERS` direkt in `/#pricing` einbetten.
3. FAQ/Trust/Frage-Element bauen.
4. Einladung `/einladung/[token]` auf dieselbe Auth-Shell bringen.
5. Browser-Trace und visuelle Prüfung nach MCP-Verfügbarkeit durchführen.
