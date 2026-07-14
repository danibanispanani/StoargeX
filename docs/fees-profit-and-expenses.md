# Gebühren, Gewinn und Betriebsausgaben

Stand: 14.07.2026 · Prompt 5

## Fachliche Grenze

Die Marktplatzrechner beantworten eine Einkaufsfrage: Reicht ein erwarteter Verkaufspreis aus, um Einkauf und direkt zurechenbare Verkaufskosten zu decken? In die Stückkalkulation fließen ausschließlich Verkaufserlös, Umsatzsteuerprofil, Einkauf, Marktplatzgebühren, eigener Versand, Verpackung, eBay-Basisanzeige und sonstige direkte Kosten ein.

Lager, Software, Versicherungen, Personal, eBay-Shop, Kaufland Basic/Plus und andere Unternehmensabonnements werden nicht auf Artikel verteilt. Sie werden unter `/finanzen/ausgaben` einmalig oder wiederkehrend geführt. Das Ergebnis ist deshalb ein operativer Deckungsbeitrag und keine Vollkosten- oder Steuerberatung.

## Berechnungsgrößen

- Kundenerlös brutto: Artikelpreis plus vom Käufer gezahlter Versand.
- Verkauf netto: Kundenerlös brutto, bei einem umsatzsteuerpflichtigen Profil um den konfigurierten Steuersatz bereinigt.
- Gewinnwirksamer Einkauf: Netto bei dokumentiertem Vorsteuerabzug, sonst Brutto.
- Bruttomarge: Verkauf netto minus gewinnwirksamer Einkauf; dies vertieft die bestehende StorageX-Definition, statt eine zweite Marge einzuführen.
- Gewinn: Bruttomarge minus gewinnwirksame Plattformgebühr, eigener Versand, Verpackung und sonstige direkte Kosten.
- Auszahlung: Kundenerlös brutto minus tatsächlich einbehaltene Plattformgebühr brutto.

Gebühren werden komponentenweise in Integer-Cents gerundet. Prozentsätze werden intern als Basispunkte geführt. Gebühren-Umsatzsteuer wird separat ausgewiesen; bei Vorsteuerabzug ist der Nettobetrag gewinnwirksam, sonst der Bruttobetrag.

## Ausgaben

Ausgaben besitzen Kategorie, Lieferant, Brutto/Netto/Steuer, Zahlungs- und Fälligkeitsdatum, Zahlungskonto, Status, Beleg, Notiz und optional ein Marktplatzkonto. Eine Wiederholungsregel materialisiert eigenständige Buchungen. Der eindeutige Schlüssel `ruleId:YYYY-MM-DD` verhindert doppelte Monatsbuchungen bei wiederholten Läufen.

CSV und XLSX verwenden die gemeinsame Importpipeline mit Vorlage, Spaltenbeschreibung, Mapping, Dry Run, Fehler-/Duplikatprüfung, bestätigtem Commit, `ImportBatch` und `SourceReference`. Nicht auflösbare Lieferanten- oder Kontobezeichnungen bleiben als Importhinweis lesbar, statt fremde Stammdaten automatisch anzulegen.

## Bewusst ausgeschlossen

Keine Fixkostenumlage, automatische Preisrecherche, Marketplace-API, CPC-/Premiumanzeigen, Kaufland-Werbung, EPR-Kosten, Fremdwährung, OSS-Komplettlogik oder automatische Gebührenaktualisierung.
