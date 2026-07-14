# Marktplatz-Preisrechner

## Routen und Eingabemodi

- `/finanzen/preisrechner/ebay`
- `/finanzen/preisrechner/kaufland`

Beide Oberflächen verwenden denselben deterministischen `MarketplacePricingService`, behalten aber marktplatzspezifische Felder und Aufschlüsselungen. Im Produktmodus werden EK, Zustand, bestätigte Marktplatzkategorie, Versand, Verpackung und Referenz-VK als überschreibbare Kopie übernommen. Im freien Modus ist kein Produkt erforderlich. Weder Berechnen noch Speichern mutiert Produktdaten; dafür existieren die ausdrücklichen Aktionen „Produktdaten aktualisieren“ und „Als Produkt übernehmen“.

## eBay.de

Der Rechner berücksichtigt Kategorie-/Zustandsprovision, marginale Preisstaffeln, fixen Bestellanteil, Shop-Angebotsgebühr, Platin-Shop-Rabatt, prozentuale Basisanzeige, Gebühren-USt und eine ausschließlich explizite internationale Gebühr. `AUTO` bei Angebotsgebühren bedeutet, dass kein nicht belegtes Freikontingent erfunden wird. Unterdurchschnittliche oder private Verkäuferprofile liefern ohne importierte Regeln „nicht vollständig unterstützt“; ein manueller Gebührenoverride bleibt sichtbar.

Nicht enthalten: Premium-Anzeigen, CPC, Kampagnenbudget, Werbeattribution und Währungsumrechnung.

## Kaufland.de

Die Provision wird auf Artikelpreis plus Käufer-Versand berechnet. Medien erhalten zusätzlich 0,70 Euro je Artikel. Basic und Plus sind Accountdaten; ihre Monatsgebühren sowie Werbung, EPR und Zusatzservices bleiben außerhalb der Produktrechnung.

## Ergebnis und Break-even

Prominent erscheinen Gewinn/Verlust, Gewinnmarge, Mindestpreis ohne Verlust, Gebühren plus direkte Kosten und Auszahlung. Die Aufschlüsselung zeigt Provision, optionale Mindest-/Höchstgrenzen, Fixanteile, Angebots-/Artikelgebühr, Basisanzeige, Shoprabatt, Gebühren-USt, eigenen Versand, Verpackung und sonstige direkte Kosten. Ein manueller Gebühren-Override ersetzt die Kataloggebühr sichtbar und wird als Warnung und Snapshot-Herkunft ausgewiesen. Farbe ist nie das einzige Signal.

Der Break-even ist keine algebraische Näherung. Eine begrenzte binäre Suche ruft für jeden Kandidaten dieselbe Produktionsberechnung auf und liefert den ersten Cent mit Gewinn größer oder gleich null. Standardobergrenze: 1.000.000 Euro; Standardabbruch: 64 Iterationen. Unerreichbare Ergebnisse erzeugen einen definierten Fehler. Zielmargenpreis und maximaler EK verwenden ebenfalls den gemeinsamen Service.

## Snapshots und Neuberechnung

Gespeichert werden Eingaben, Fee-Breakdown, Kategorie/Zustand, Account, Katalog/Version, Regel-IDs, Gewinn, Marge, Break-even, Auszahlung, Zeitpunkt, Modus, Quelle, Status und ein Fingerprint. Änderungen an EK, Kategorie, Zustand, Versand, Verpackung, Account, Katalog oder Regeln markieren den Snapshot als veraltet. Keine Berechnung läuft bei jedem Rendern.

In der Produktansicht können einzelne oder explizit ausgewählte Produkte je Marktplatz neu berechnet werden. Nach einer Katalogaktivierung steht zusätzlich „Betroffene neu berechnen“ bereit. Jede Neuberechnung erzeugt einen neuen historischen Snapshot und markiert ältere Snapshots als veraltet. Sie verwendet ausschließlich bestätigte Kategorien, aktive Accounts, vorhandene Produktdefaults und die letzte explizite Szenariobasis. Fehlende Werte werden als „unvollständig“ zurückgemeldet, nicht durch Schätzwerte ersetzt. Bei einer neuen Katalogversion werden bestätigte Zuordnungen nur dann auf die neue Kategorieversion übertragen, wenn dieselbe externe Kategorie-ID existiert; andernfalls wechselt das Mapping auf `REVIEW_REQUIRED`.

Verkäufe speichern den tatsächlich verwendeten Gebührenbetrag sowie Account, Katalogversion und Erfassungsart als JSON-Snapshot. Spätere Katalogänderungen verändern bestehende Verkäufe nicht. Manuelle Gebühren bleiben möglich und werden als manuell gekennzeichnet.

## Einkauf und Export

Aus einem Einkaufsdetail kann eine Position mit Produkt, Brutto-EK und Standardzustand in eBay oder Kaufland geöffnet werden. Dies bestätigt keinen Einkauf. Gespeicherte Kalkulationen sind über `/api/export/kalkulationen?format=csv|xlsx` exportierbar.
