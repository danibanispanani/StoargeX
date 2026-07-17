# StorageX Insight Dashboard

## Status und Ziel

Das Dashboard ist das operative Operations- und Performance-Cockpit der internen StorageX-App. Es verdichtet bestehende Handels-, Bestands-, Retouren-, Kosten- und Teamdaten, ohne eine zweite Reporting-Domain oder neue Bestandsschatten einzuführen.

Die Umsetzung ersetzt das frühere Raster aus KPI-Karten, Standarddiagrammen und unbeschriftetem Plattform-Donut. Die neue Oberfläche priorisiert:

- Aufmerksamkeit vor Dekoration,
- unmittelbare Vorperiodenvergleiche,
- transparente Formeln und Datenbasis,
- getrennte fachliche Drucksignale,
- handlungsfähige Drill-downs in operative Tabellen,
- kompakte, responsive Informationsdichte.

Es gibt keinen synthetischen „Health Score“. Bestands- und Margenqualität werden durch ihre überprüfbaren Bestandteile erklärt.

## Architektur

### Tiefer Modulvertrag

Das Dashboard besteht aus drei Schichten:

1. `lib/dashboard/insight-dashboard.ts`
   - reine Perioden-, Vergleichs- und Kennzahlenberechnungen;
   - keine Datenbank- oder UI-Abhängigkeit;
   - deterministisch mit explizitem `now`;
   - stabil für leere und große Eingaben.
2. `lib/dashboard/load-insight-dashboard.ts`
   - einziger Datenadapter;
   - akzeptiert ausschließlich `TenantDb`;
   - validiert alle URL-Filter gegen tenant-sichtbare Optionen;
   - lädt die Fachbereiche in einer festen Zahl paralleler Abfragen;
   - erzeugt ein einzelnes typisiertes Dashboard-View-Model.
3. `components/dashboard/insight-cockpit.tsx`
   - rendert ausschließlich das View-Model;
   - führt keine Berechnungen oder Datenbankzugriffe aus;
   - enthält Formelerklärungen und operative Links.

Die bestehende `lib/reporting.ts` bleibt für noch vorhandene andere Reporting-Aufrufer kompatibel. Das neue Dashboard baut keine parallele Fachlogik für Verkauf, Bestand, Retouren, Ausgaben, Schulden oder Aufgaben.

### Tenant-Sicherheit

Der Loader nimmt keine `organizationId` entgegen. Alle Queries laufen über `TenantDb`. Dieser setzt `app.current_org_id` transaktionslokal; die bestehenden PostgreSQL-RLS-Policies bleiben die harte Mandantengrenze.

URL-IDs für Plattform, Plattformkonto und Mitglied werden zusätzlich gegen die tenant-sichtbaren Filteroptionen validiert. Fremde oder veraltete IDs werden verworfen und erweitern niemals den Query-Scope.

### Query- und Performancevertrag

- Keine Query wird innerhalb einer Ergebniszeilen-Schleife ausgeführt.
- Filteroptionen werden gemeinsam geladen und vor der Datenermittlung validiert.
- Fachabfragen laufen danach als begrenztes `Promise.all`.
- Beziehungen werden mit schmalen `select`-Projektionen geladen.
- Tagestrends und Produktrankings werden auf dem Next.js-Server aus bereits eingeschränkten Verkaufszeilen gebildet; der Browser erhält nur das fertige View-Model.
- Es gibt derzeit kein zusätzliches Cache. Dadurch kann kein tenant- oder filterübergreifender Cache-Key fehlen. Ein späteres Cache muss Organisation, Zeitraum und alle fachlich wirksamen Filter enthalten.
- Migrierte Legacy-Bestände werden anhand `OwnedStockLot.legacySource` nicht doppelt gezählt.

## Zeitraum und Vergleich

Unterstützte Zeiträume:

- letzte 7 Tage,
- letzte 30 Tage,
- dieses Jahr bis heute,
- vollständiges Vorjahr,
- benutzerdefinierter Von-/Bis-Zeitraum.

Jeder Vergleich verwendet den unmittelbar vorhergehenden Zeitraum mit exakt derselben Dauer. Beispiel: Die letzten 30 Tage werden mit den 30 direkt davorliegenden Tagen verglichen.

Bei einer Vorperiode von null wird keine künstliche Prozentzahl erzeugt. Die UI zeigt `Neu`.

## Filter und Geltungsbereich

| Filter | Wirkt auf | Wirkt bewusst nicht auf |
| --- | --- | --- |
| Zeitraum | Verkäufe, Kundenretouren, Ausgaben, erledigte Aufgaben | aktueller Bestand, offene Schulden, offene Lieferantenretouren |
| Plattform | Verkäufe, Kundenretouren, gelisteter Bestand | Schulden, Aufgaben, Lieferantenfristen |
| Plattformkonto | Verkäufe, Kundenretouren, accountbezogene Ausgaben | Bestand ohne Accountrelation, Schulden, Aufgaben |
| Produktkategorie | Verkäufe, Bestand, beide Retourenarten, Einkaufsfristen | Schulden, Aufgaben |
| Eigen-/Konsignationsbestand | Verkäufe über Allocation-Snapshots, Bestand | Lieferantenretouren, da sie nur Eigenbestand betreffen |
| Mitglied | Team Flow | Handels-, Finanz- und Bestandskennzahlen |

Der aktive Geltungsbereich wird direkt unter der Filterleiste erklärt. Plattformkonten sind eigene IDs und werden nicht aus Anzeigenamen oder persönlichen Sonderfällen abgeleitet.

Bei Verkäufen mit mehreren Positionen werden Kategorie- und Bestandsartfilter nicht auf den gesamten Beleg übertragen. Umsatz, Gewinn, Gebühren, Versandkosten und zugehöriger Retourenverlust werden anhand des Bruttowertanteils der passenden Positionen zugerechnet; gemischte Owned-/Consignment-Allokationen werden zusätzlich mengenanteilig gewichtet.

## Kennzahlendefinitionen

### Today / Aufmerksamkeit

Die Queue wird nach operativer Dringlichkeit sortiert:

1. überfällige Aufgaben,
2. Lieferantenretouren mit Frist in höchstens 14 Tagen,
3. offene Lieferantenerstattungen,
4. niedriger Bestand,
5. Verkäufe mit fehlender Rechnung oder Gebührenbuchung,
6. offene Schulden,
7. Importkonflikte und Review-Fälle,
8. bezahlte beziehungsweise versandte Verkäufe ohne Portobuchung,
9. Einkäufe vor Rückgabefrist.

Es erfolgt keine automatische Lieferantenrückgabe. Die Queue fordert immer eine bewusste Prüfung oder Bestätigung.

### Trade Pulse

- Umsatz: Summe `Sale.salePriceCents` im Zeitraum.
- Gewinn: Summe des bestehenden serverseitigen `Sale.profitCents`-Snapshots.
- Gewinnmarge: Gewinn geteilt durch Umsatz.
- Verkäufe: Anzahl nicht stornierter Verkaufsbelege.
- Veränderung: `(aktueller Wert - Vorperiode) / Betrag der Vorperiode`.
- Trend: Tageswerte für 7 beziehungsweise 30 Tage.

### Inventory Health

- verfügbar, reserviert, in Prüfung und defekt: Summe der entsprechenden `InventoryPosition`-Buckets;
- niedriger Bestand: Produkt hatte insgesamt mehr als eine Einheit und liegt mit positivem Restbestand am konfigurierten Organisations-Schwellenwert;
- langsam: verfügbare Einheit liegt seit mehr als 90 Tagen;
- gebundenes Kapital: verfügbarer Eigenbestand multipliziert mit dem EK netto;
- Eigen- und Konsignationsbestand bleiben getrennt auswertbar.

Der Bereich verwendet bewusst keinen beliebigen Gesamtscore.

### Margin Quality

- Marge je Verkauf: Gewinn geteilt durch VK brutto;
- Zielmarge: transparent festgelegte Beobachtungsschwelle von 10 Prozent;
- Verteilung: negativ, 0–10 Prozent, 10–20 Prozent, mindestens 20 Prozent;
- Gebührenbelastung: Plattform- plus Zahlungsgebühr geteilt durch Umsatz;
- Versandkostenbelastung: eigene Versandkosten geteilt durch Umsatz;
- Produktbeitrag: Verkaufsgewinn wird bei Mehrproduktverkäufen gleich auf die enthaltenen Produkte verteilt.

### Return Pressure

Kundenretouren und Lieferantenretouren werden nicht zusammengezählt.

Kundenretouren:

- Quote: im Zeitraum gemeldete Kundenretouren geteilt durch Verkäufe im Zeitraum;
- Verlust: Summe der bestehenden serverseitigen `Return.lossCents`;
- offen: nicht terminale Kundenretourenstatus.

Lieferantenretouren:

- offen: alle nicht abgeschlossenen, stornierten oder abgelehnten Vorgänge;
- Frist: offene Vorgänge mit Frist bis einschließlich 14 Tage ab heute;
- offene Erstattung: `max(0, erwartet - tatsächlich)`;
- gebundenes Kapital: Menge mal ursprünglicher EK netto der offenen Positionen.

### Cash and Cost

- einmalige Ausgaben: gebuchte Expense-Vorgänge ohne Recurrence-Bezug;
- wiederkehrende Kosten: gebuchte Regelquellen oder erzeugte Vorkommen;
- Gewinn vor Ausgaben: Verkaufsgewinn im Zeitraum;
- Gewinn nach Ausgaben: Verkaufsgewinn minus gebuchte Bruttoausgaben;
- erwartete Auszahlungen: Umsatz abzüglich Plattform- und Zahlungsgebühren der Status `PENDING`, `PAID` und `SHIPPED`;
- offene Schulden: Betrag minus bereits bezahlter Betrag;
- Cash-Recovery: tatsächlich erhaltene Lieferantenerstattung geteilt durch erwartete Lieferantenerstattung; ohne erwartete Erstattung wird kein Prozentwert erfunden.

### Team Flow

- offen: `OPEN` oder `IN_PROGRESS`;
- überfällig: offene Aufgabe mit Frist vor dem aktuellen Kalendertag;
- Blocker: offene Aufgabe mit Priorität `URGENT`;
- Verteilung: offene Aufgaben je aktuellem Assignee, nicht zugewiesene separat;
- Durchlaufzeit: Mittelwert aus `completedAt - createdAt` der im Zeitraum erledigten Aufgaben.

Checklistenfortschritt bleibt im Aufgabenmodul. Das Dashboard erzeugt keinen bedeutungslosen Prozentwert.

## Drill-down-Matrix

| Signal | Operatives Ziel |
| --- | --- |
| Überfällige Aufgaben | `/aufgaben?view=faellig` |
| Lieferantenfristen | `/retouren/lieferanten?preset=deadlines` |
| Lieferantenerstattungen | `/retouren/lieferanten?preset=refund` |
| Niedriger Bestand | `/produkte?preset=low-stock` |
| Langsamer Bestand | `/lager?view=stock&alter=langsam` |
| Fehlende Verkaufsbuchungen | `/verkauf?preset=finances&buchung=fehlt&von=…&bis=…` |
| Versandaktionen | `/verkauf?preset=shipping&porto=offen&von=…&bis=…` |
| Offene Schulden | `/schulden?preset=due` |
| Einkaufsfristen | `/einkauf?preset=deadlines` |
| Kundenretourenverlust | `/retouren/kunden?preset=finances` |
| Margenqualität | `/verkauf?preset=finances` |
| Ausgaben | `/finanzen/ausgaben` |
| Team Flow | `/aufgaben?view=team` |

Importkonflikte öffnen `/importe?status=konflikt`. Die read-only Review-Tabelle basiert direkt auf `ImportBatch` und `SourceReference`, zeigt die aktuellen 100 Treffer einer Suche und verlinkt von jeder SourceReference zurück in das bestehende Fachmodul. Sie ist keine zweite Importengine.

## Responsive und Accessibility

- Das Cockpit wechselt von breiten Doppelspalten auf eine lineare mobile Lesereihenfolge.
- Filter umbrechen und bleiben als echte beschriftete Form Controls tastaturbedienbar.
- Attention-Einträge sind vollständig fokussierbare Links.
- Sparklines besitzen Textbeschriftungen für Screenreader.
- Statusbänder besitzen eine vollständige `aria-label`-Zusammenfassung.
- Farben werden nie allein verwendet; Zahl, Bezeichnung und Handlung bleiben sichtbar.
- Motion ist auf Hover-/Fokusfeedback beschränkt.

## Test- und Validierungsvertrag

Automatisierte Tests decken ab:

- 7-/30-Tage- und benutzerdefinierte Zeiträume;
- unmittelbar vorhergehende Vergleichsperiode;
- Null-Vorperiode;
- Plattform-, Account-, Kategorie-, Bestandsart- und Mitglied-Scope;
- RLS-gebundene Tenant-Schnittstelle;
- Gewinn, Marge, Gebühren- und Versandlast;
- einmalige und wiederkehrende Ausgaben;
- getrennte Kunden- und Lieferantenretouren;
- Bestands-Buckets, niedrige und langsame Artikel;
- Team Flow und Durchlaufzeit;
- leere Daten;
- 10.000 Verkaufszeilen;
- priorisierte Drill-down-Links.

Die Browserprüfung umfasst Desktop, Tablet und Mobile, Tastaturfokus, Filter, Navigation, Console, Network, Hydration, Lighthouse und einen Performance Trace.

### Verifikation am QA-Datensatz

- Viewports: 1440, 1280, 768 und 390 Pixel ohne dokumentweiten Horizontal-Overflow;
- Desktop-Lighthouse: Accessibility 100, Best Practices 100, SEO 100, Agentic Browsing 100, 53 bestanden, 0 fehlgeschlagen;
- Mobile-Lighthouse: Accessibility 100, Best Practices 100, SEO 100, Agentic Browsing 100, 53 bestanden, 0 fehlgeschlagen;
- Console/Network: keine Warnungen, Fehler, Issues oder Hydration-Abweichungen; Dashboard-Dokument mit HTTP 200;
- Drill-down-Probe: 43 signalisierte fehlende Buchungen führen zu exakt 43 nicht stornierten Verkaufsbelegen im gleichen Zeitraum;
- Fast-4G-Trace im Next.js-Dev-Modus: LCP 3,916 Sekunden, CLS 0,00. Davon entfallen 3,131 Sekunden auf den serverseitigen TTFB der externen QA-Datenbank und 0,786 Sekunden auf Render Delay. Die Antwort ist gzip-komprimiert und redirect-frei. Ein getesteter Suspense-Streaming-Umbau wurde verworfen, weil er den LCP messbar auf 5,558 Sekunden verschlechterte.

Der Dev-Trace ist kein Produktionsbenchmark. Er dokumentiert den verbleibenden Schwerpunkt korrekt als serverseitige Datenlatenz, nicht als Client-Layout- oder Animationsproblem.
