# Public Design Direction

Stand: 2026-07-10

## Leitidee: "Transit Ledger"

StorageX soll nicht wie eine AI-SaaS und nicht wie ein generisches Dashboard wirken. Die öffentliche Oberfläche soll wie ein präzises Betriebssystem für Warenbewegungen auftreten.

Die kreative Leitidee heißt:

> Transit Ledger: Jede Ware hat eine Spur. Jeder Zustand ist verbucht. Jeder Schritt bleibt nachvollziehbar.

Der Look entsteht aus Logistik, Buchung, Prüfspur, Etiketten, Belegen, Kontrollpunkten und Bewegung. Nicht als nostalgisches Lagerhaus, sondern als modernes digitales Kontrollsystem für kleine Händlerteams.

## Markenbild

Die Produktidee `Einkauf -> Bestand -> Verkauf -> Retoure -> Auszahlung` wird nicht nur als Text erklärt, sondern als sichtbare Prozessspur:

- Stationen als Kontrollpunkte
- Bewegungen als Linien, Buchungen, Raster und Zeitmarken
- Geld und Ware als zwei parallele Spuren
- Retouren als Rückschleife, nicht als Fehler
- Auszahlungen als finaler Abschlussstempel

## Tonalität

### Stimme

- ruhig
- operativ
- präzise
- vertrauenswürdig
- handwerklich, nicht hype-getrieben

### Keine Standard-SaaS-Sprache

Vermeiden:

- "Alles im Griff"
- "Skaliere dein Business"
- "Automatisiere deinen Workflow"
- "KI-gestützt"
- "smarte Lösung"

Stattdessen:

- "Jede Bewegung bleibt lesbar."
- "Vom Wareneingang bis zur Auszahlung."
- "Bestand, Marge und Retoure in einer Spur."
- "Für Teams, die Handel nicht in Tabellen nachbauen wollen."
- "Wenn eine Retoure zurückkommt, bleibt die Geschichte erhalten."

## Farbpalette

Die vorhandenen Tokens sind brauchbar, sollten aber pointierter eingesetzt werden.

### Kernfarben

- `Ink #14171c`: Haupttext, präzise Linien, dunkle Flächen.
- `Fog #edede7`: Papier-/Beleggrund, öffentliche Hintergrundfläche.
- `Transit Teal #1b8f86`: aktive Warenbewegung, primärer CTA.
- `Cargo Amber #d98e2b`: Auszahlung, Warnung, Highlight, "Geldspur".
- `Customs Red #c0483b`: Retoure/Problem/Defekt nur sparsam.
- `Slate #545b66`: sekundäre Texte, Legenden, Metadaten.

### Erweiterung

Für die neue öffentliche UI:

- `Paper #f7f3e8`: wärmerer, belegenaher Hintergrund.
- `Rail #2b3038`: technische Linien/Tracks.
- `Stamp #8f5b2d`: trockener Braunton für Stempel/Belegdetails.
- `Mint Signal #d8ece8`: ruhige Erfolgsflächen.

Keine violetten AI-Gradienten, keine Neon-Orbs, keine "tech blue" Default-Flächen.

## Typografie

Bestehende Fonts können bleiben, aber anders eingesetzt werden.

### Display

`Space Grotesk` für große Headlines, aber mit engerer Hierarchie:

- Hero groß, aber nicht gigantisch.
- Abschnittstitel knapp.
- Keine übergroßen Marketing-Wörter in Cards.

### UI/Text

`Inter` für Fließtext, Formulare, Navigation.

### Zahlen/Labels

`JetBrains Mono` für:

- Order-IDs
- K-Nummern
- Margen
- Bewegungsstatus
- Prozesslabels
- kleine "ledger rows"

## Layout-Prinzipien

### Nicht: Hero plus Kartenstapel

Die Seite soll nicht wie eine Reihe isolierter Cards wirken. Stattdessen:

- lange horizontale und vertikale Prozessspuren
- breite, ruhige Flächen
- eingebettete Produktzustände
- Tabellen-/Belegfragmente als visuelle Elemente
- wiederkehrende Kontrollpunkt-Module

### Raster

- 12-Spalten-Grid auf Desktop.
- Mobile als gestapelte Prozesskarte, nicht als reduzierte Desktop-Kopie.
- Abschnittsabstände eher großzügig, aber Inhalte dichter als klassische SaaS-Landingpages.

### Flächen

- Hintergrund wie heller Beleg/Papier.
- Dunkle "Control Room"-Momente nur gezielt, z. B. Hero oder Prozessabschluss.
- Keine Cards in Cards.
- Cards nur für einzelne wiederholte Items: FAQ, Pricing-Tiers, Auth-Form.

## Komponentenprinzipien

### Buttons

- Primär: Transit Teal, klar, eckiger als aktuell.
- Sekundär: Outline mit technischer Linie.
- Tertiär: Textlink mit Richtungspfeil.
- Keine pill-heavy Button-Landschaft.

### Karten

- Radius 6-8px.
- Dünne Linien, keine schweren Schatten.
- Innenlayout mit Label-Zeilen, Statuschips, kleinen Buchungszeilen.
- Cards sollen wie operative Einheiten wirken, nicht wie Marketing-Kacheln.

### Linien

Linien sind ein Markenmittel:

- Track-Linien zwischen Stationen.
- Dotted return line für Retouren.
- Ledger-Linien in Tabellenfragmenten.
- Stempelrahmen für Trust/Legal/Compliance.

### Icons

Icon-Stil:

- lineare, technische Icons
- weniger dekorativ, mehr funktional
- gleiche Strichstärke wie Prozesslinien
- Lucide kann bleiben, aber mit eigener Rahmung: Kontrollpunkte, Labels, Stempel.

Mit `better-icons` später prüfen:

- logistics
- barcode
- receipt
- route
- package-check
- rotate-ccw-square
- coins/exchange

## Motion-Prinzipien

Motion soll produktlogisch sein, nicht dekorativ.

### Erlaubt

- Warenpunkt fährt entlang der Prozessspur.
- Buchungszeile wird "eingestempelt".
- Retoure zeichnet eine Rückschleife.
- Zähler laufen nur dort, wo sie eine operative Kennzahl erklären.
- Auth-Seiten nutzen minimale Statusbewegung, z. B. Fokuslinie oder Checkpoint.

### Nicht erlaubt

- Neon glow loops.
- Partikel-Hintergründe.
- generische Reveal-Flut.
- große Parallax-Show ohne Produktbezug.
- Animation, die Tabellen/Formulare verschiebt.

## Hero-/3D-Idee

### Idee: "The Moving Ledger"

Ein 3D- oder pseudo-3D-Hero zeigt eine schräge, hochwertige Arbeitsfläche:

- links: Wareneingangsetikett
- Mitte: Bestandsspur mit Kisten-/Barcode-Element
- rechts: Verkauf/Order und Auszahlung
- unten: Retoure als sichtbare Rückspur
- darüber: kurze Ledger-Zeilen mit IDs, Marge, Status

Das Objekt darf wie ein taktiles Produktinstrument wirken: Papier, matte Schienen, Metallstifte, digitale Statusmarken. Keine futuristische Glaskugel, kein AI-Neon.

### Umsetzung in Phase 2

Für die erste produktive Umsetzung reicht pseudo-3D mit CSS/HTML/SVG:

- isometrisches Ledger-Board
- SVG-Track
- kleine DOM-Karten als Stationschips
- optional später Three.js, wenn Browser-Test vorhanden ist

## Gemeinsame Sprache für Landingpage und Auth

Auth darf nicht isoliert sein. Login/Register sollten dieselbe Prozesssprache nutzen:

- linke/obere Markenfläche mit Mini-Track
- "Du meldest dich an der Leitstelle an"
- Login als "Zugang zum Kontrollraum"
- Register als "Erste Organisation anlegen"
- klare Links zurück: Startseite, Preise, Datenschutz
- Wechsel Login/Register oben oder unterhalb des Titels sichtbar

## Landingpage-Struktur als Design-Erzählung

1. Hero: Moving Ledger, ein Satz, zwei CTAs.
2. Problem: Tabellen verlieren die Spur, nicht moralisch, sondern operativ.
3. Workflow: Einkauf -> Bestand -> Verkauf -> Retoure -> Auszahlung.
4. Produktmodule: Lager, Verkauf, Retouren, Konsignation, Schulden/Team.
5. Proof/Trust: Audit-Log, RLS, 2FA, DSGVO, Steuerlogik.
6. Pricing: kurze Entscheidung.
7. About: warum dieses Produkt existiert.
8. FAQ/Fragebox.
9. Footer/Legal.

## Do

- Produktlogik als visuelles System verwenden.
- Bestehende Tokens schärfen statt komplett ersetzen.
- Auth und Landingpage in einer Sprache gestalten.
- Pricing in die Single Page integrieren.
- Legal sichtbar und seriös anbinden.
- Echte App-Screens oder abstrahierte Ledger-Fragmente zeigen.
- Retoure als normale Rückspur darstellen, nicht als Ausnahme.

## Don't

- Kein Glassmorphism.
- Keine Neon-AI-Glow-Flächen.
- Keine violetten Standard-Gradient-Heroes.
- Keine generischen "Feature Cards" als Hauptsprache.
- Keine fiktiven Testimonials.
- Keine dekorativen Icons ohne Funktion.
- Keine übertriebenen Hero-Headlines ohne Produktbezug.
- Keine Rechtsseiten im Footer verstecken oder auslassen.

## Qualitätsziel

Die öffentliche Oberfläche soll sich anfühlen wie ein echtes Produkt mit eigener operativer Welt. Nutzer sollen nach wenigen Sekunden verstehen:

StorageX ist nicht "noch ein Tool". StorageX ist die Spur, auf der Handelsware, Geld und Verantwortung zusammenlaufen.
