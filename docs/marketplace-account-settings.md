# Marktplatzkonten

Stand: 14.07.2026 · Prompt 5

## Zweck und Zugriff

Unter `/einstellungen/marktplatzkonten` werden mehrere operative Accounts derselben Plattform pro Organisation verwaltet. Accountnamen sind konfigurierbare Daten; StorageX leitet daraus keine Geschäftslogik ab. OWNER und ADMIN verwalten Accounts, MEMBER nutzen aktive Accounts im Preisrechner und READONLY darf die Einstellungen sowie Ergebnisse nur lesen. Zugangsdaten und API-Secrets gehören weiterhin ausschließlich in den Credential-Tresor.

## eBay.de

Ein eBay-Konto speichert Anzeigename, Accounttyp, Verkäuferstatus, Shopmodell, optionalen Standardzustand, Standardversand und Verpackung, Basisanzeigen-Voreinstellung und -Satz, Steuerprofil sowie Aktivstatus. Unterstützte Shopmodelle sind kein Shop, Basis, Top, Premium und Platin. Das Shopmodell beeinflusst nur katalogseitig belegte Provisionen, Schwellen, Rabatte und Angebotsgebühren. Die monatliche Shopgebühr wird als Betriebsausgabe geführt und niemals automatisch auf eine Produktkalkulation umgelegt.

Der Startkatalog unterstützt gewerbliche Verkäufer mit überdurchschnittlichem beziehungsweise Top-Servicestatus. Für ein nicht belegtes Verkäuferprofil bricht die Regelauflösung mit „nicht vollständig unterstützt“ ab. Eine sichtbare manuelle Gebührenkorrektur bleibt möglich und wird im Snapshot gekennzeichnet.

## Kaufland.de

Ein Kaufland-Konto speichert Anzeigename, Marktplatzland, Basic/Plus, Standardversand, Verpackung, Steuerprofil und Aktivstatus. In der Beta ist nur Deutschland aktiv. Basic und Plus bleiben Account- und Ausgabendaten, solange die offizielle Quelle keine direkte Auswirkung auf die konkrete Verkaufsprovision belegt; Monatsentgelte, Werbung, EPR und Zusatzservices gehen nicht in die Stückkalkulation ein.

## Steuer- und Standardwerte

Das Account-Steuerprofil überschreibt für die Simulation das Organisationsprofil. Bei `VAT_REGISTERED` verwendet der Rechner den Organisations-Standardsteuersatz und den dokumentierten Vorsteuerabzug. Private und Kleinunternehmerprofile rechnen ohne herausgerechnete Verkaufs-Umsatzsteuer. Versand, Verpackung, Zustand und Anzeigenwert sind nur Vorbelegungen: Änderungen im Rechner bleiben lokal, bis „Kalkulation speichern“ oder „Produktdaten aktualisieren“ ausdrücklich ausgelöst wird.

## Katalogbindung und spätere Erweiterung

Ein Account kann einen Standard-Gebührenkatalog referenzieren; berechnet wird ausschließlich gegen eine aktive, zeitlich gültige Version und eine bestätigte Produkt-/Marktplatzkategorie. Bei Aktivierung einer Nachfolgeversion wird die Standardreferenz aller passenden Konten transaktional aktualisiert. Historische Kalkulationen und Verkäufe speichern Katalogversion, Regel und Gebühren-Snapshot. Neue Länder, Verkäuferprofile oder Shopvarianten werden erst nach normalisiertem Import, Validierung, Review und Aktivierung angeboten.
