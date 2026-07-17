# StorageX Beta – Testszenarien

Stand: 17. Juli 2026

Legende:

- **Automatisiert bestanden**: deterministische Unit-/Service-/Integrationstests.
- **Browser bestanden**: gegen das isolierte QA-Tenant im realen Browser ausgeführt.
- **Bedingt**: produktive externe Infrastruktur erfordert einen Deployment-Schritt.

## Eigener Bestand

| Schritt | Nachweis | Ergebnis |
| --- | --- | --- |
| Organisation und Mitgliedschaft | Registrierung, Rollen- und Tenant-Tests | Automatisiert bestanden |
| Lieferant und Einkauf | Partner-/Purchase-/Inbound-Services | Automatisiert bestanden |
| Teil- und Restwareneingang | Receipt-Lines, mehrere Lots, Purchase-Receipt-Movements | Automatisiert bestanden |
| Listing und Verkauf | Sales-/Allocation-/Inventory-Service | Automatisiert bestanden |
| Gebühren-Snapshot | Gebührenregel- und Sales-Tests | Automatisiert bestanden |
| Kundenretoure und Wiedereinlagerung | ReturnAllocation und RETURN-Movements | Automatisiert bestanden |
| Dashboard-Update | Insight-Berechnungen und Browser-Drill-down | Automatisiert und Browser bestanden |

Erwartete Invarianten: keine direkte Mengenmutation, keine Überallokation, Belegnummer eindeutig, alle Relationen im Tenant.

## Lieferantenretoure

Einkauf, Frist, Anlage, Teilmenge, Versandbewegung, Tracking, Erstattung, Differenz, Ablehnung und Doppelbuchung werden durch Supplier-Return- und Inventory-Service-Tests abgedeckt. Die Release-Integritätsprüfung bestätigt zusätzlich, dass jeder versendete Status eine passende `SUPPLIER_RETURN_OUT`-Bewegung mit identischem Tenant, Bestand und identischer Menge besitzt.

Ergebnis: **Automatisiert bestanden**.

## Konsignation

Trial/aktiv/Grace/abgelaufen, serverseitiger Route-/Action-Gate, Partnerposition, Verkauf, Kundenretoure, Schuld/Auszahlung und Datenerhalt ohne Add-on werden durch Entitlement-, Billing-, Consignment-, Sales- und Return-Tests abgedeckt. Navigation und Trial-Zustand wurden im QA-Tenant browsergeprüft.

Ergebnis: **Automatisiert und Browser bestanden**. Live-Stripe-Aktivierung bleibt deploymentbedingt.

## Gebühren und Profit

Plattformkonto, versionierte Gebührenregel, Profit-Simulation, Verkaufssnapshot und spätere Regeländerung werden durch Marketplace-Pricing-, Fee-Rule- und Sales-Tests abgedeckt. Alte Verkäufe lesen ihren Snapshot und werden nicht rückwirkend neu berechnet.

Ergebnis: **Automatisiert bestanden**.

## Ausgaben

Einmalige und wiederkehrende Ausgaben, Recurrence-Erzeugung, Import und Dashboard-Ergebnis nach Ausgaben sind automatisiert geprüft. `duplicate_recurring_expense_occurrences` bestätigt im QA-Datenbestand, dass keine doppelten Vorkommen existieren.

Ergebnis: **Automatisiert bestanden**.

## Teamaufgaben

Mehrere Assignees, primäre Verantwortung, Rechte, Checklistenfortschritt, Frist, Fachobjektlinks und Archiv sind automatisiert geprüft. Aufgabenansichten wurden bei 1440, 768 und 390 px browsergeprüft.

Ergebnis: **Automatisiert und Browser bestanden**.

## Datenmigration und Portabilität

Ausgeführt:

1. Produkt-Beispielvorlage als XLSX geladen.
2. Test-CSV mit deutscher Kopfzeile hochgeladen.
3. automatische Zuordnung aller acht Spalten geprüft.
4. Dry Run mit 1/1 importierbaren Zeilen, 0 Konflikten und 0 Fehlern.
5. Import bestätigt und Historie geprüft.
6. gefilterten CSV-Export geladen und auf genau die Testzeile geprüft.
7. Inventory-Ledger als MEMBER exportiert.
8. Vollauszug als MEMBER auf HTTP 403 geprüft.

DSGVO-Abdeckung, Secret-Ausschluss, OWNER-Gate, Duplikate, Mapping und XLSX/CSV-Formate sind zusätzlich automatisiert geprüft.

Ergebnis: **Automatisiert und Browser bestanden**. Erfolgreicher OWNER-DSGVO-Browserexport bleibt als Staging-Schritt dokumentiert.

## Browser-Matrix

Geprüfte Kernrouten:

`/dashboard`, `/einkauf`, `/lager`, `/produkte`, `/verkauf`, `/retouren/kunden`, `/retouren/lieferanten`, `/konsignation`, `/schulden`, `/versand`, `/aufgaben`, `/team`, `/zugangsdaten`, `/einstellungen`, `/daten/import`, `/daten/export`, `/finanzen/ausgaben`, `/finanzen/gebuehren` und beide Preisrechner.

Für 1440, 1280, 768 und 390 px wurden Navigation, Overflow, Tabellen, Drawer, Fokus, Escape-Verhalten, Console, Network und Hydration geprüft. Breite Tabellen bleiben innerhalb ihres eigenen Scrollcontainers.

## Abschlusskriterium

Alle deterministischen Release-Gates sind grün. Externe Live-Dienste und ein echter Restore werden vor einem öffentlichen Rollout als Deployment-Check ausgeführt, blockieren aber die kontrollierte Beta nicht.
