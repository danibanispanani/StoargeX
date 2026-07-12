# StorageX – vollständiger SaaS-Capability-Audit

**Stand:** 13.07.2026  
**Repository/Produktbezeichnung im Code:** `StoargeX` (in diesem Dokument als *StorageX* bezeichnet)  
**Audit-Art:** Read-only-Code-, Schema-, Migrations-, Test- und begrenzter Browser-Audit. Keine Produktdatei, Route, Migration oder Datenbank wurde verändert.  
**Git-Baseline:** sauberer Worktree, kein Staged-/Unstaged-Diff; HEAD `7fb113a Polish public experience and interactions`.

## 1. Lesart, Evidenz und Grenzen

### Evidenzstufen

| Kennzeichnung | Bedeutung |
|---|---|
| **Code- und Schema-basiert nachgewiesen** | In Route, Server Action, Service, Prisma-Schema oder Migration konkret vorhanden. |
| **UI sichtbar, Funktion nicht vollständig validiert** | Komponente/Page ist im Code vorhanden, aber der Flow wurde nicht mit einer eingeloggten Testorganisation end-to-end ausgeführt. |
| **Im Datenmodell vorhanden, UI-Verfügbarkeit unklar** | Model/Feld ist vorhanden, eine sichtbare Bedienoberfläche wurde im Audit aber nicht nachgewiesen. |
| **Unklar / muss verifiziert werden** | Die Codebasis belegt den Punkt nicht ausreichend oder er hängt von Umgebung/Konfiguration ab. |

### Auditquellen

- `AGENTS.md`, `README.md`, `package.json`, `DEPLOYMENT.md` und sämtliche vorhandenen Dateien unter `docs/` wurden ausgewertet.
- Vollständige Prisma-Struktur, 17 Migrationsverzeichnisse, App-/API-Routen, Auth/Middleware, Actions, Services, UI-Komponenten und alle 12 Vitest-Dateien wurden untersucht.
- Chrome DevTools fand einen vorhandenen Entwicklungsserver. Der anonyme Aufruf von `http://localhost:3005/dashboard` führte auf `http://localhost:3000/login?callbackUrl=%2Fdashboard`; die Login-Seite wurde mit HTTP 200 geladen. In der Konsole erschienen nur Fast-Refresh-Logs, keine Errors. Das belegt die Schutzgrenze, nicht die internen Fachabläufe.
- `next-devtools` meldete keinen MCP-fähigen Server. Das Projekt verwendet **Next.js 15.5.20**; der Runtime-MCP-Endpunkt ist laut Tool erst ab Next.js 16 verfügbar. Dies ist eine Tool-/Versionsgrenze, kein nachgewiesener Routingfehler.
- `codebase-memory-mcp` war in dieser Session nicht als aufrufbares Tool exponiert. Der Audit wurde daher direkt gegen die Repository-Dateien durchgeführt.
- `shadcn` ist über die Registry `@shadcn` konfiguriert; die lokalen Primitives decken u. a. Alert, Avatar, Badge, Button, Card, Dialog, Dropdown, Form, Input, Label, Select, Sheet, Sonner, Switch, Table und Tabs ab.

### Nicht durchgeführt

- Kein Login mit realen oder Test-Zugangsdaten, keine Datenanlage, keine Datenänderung und keine Migration.
- Kein Build, Lint oder Testlauf in diesem Audit; frühere Validierungsresultate werden nicht als frischer Auditnachweis übernommen.
- Kein externer Marktvergleich mit einem konkret benannten Wettbewerber. Die Gap-Analyse nutzt deshalb eine generische Benchmark für Warenwirtschaft/Resale-/OMS-SaaS und ist keine Aussage über ein bestimmtes Fremdprodukt.

## 2. Produktbild in einem Satz

StorageX ist eine mandantenfähige, deutschsprachige Warenwirtschaft für Handels-GbRs bzw. Resale-Teams: eigener und konsignierter Bestand, Einkauf, Verkauf, Retouren, Schuldenausgleich, Teamaufgaben, Versandkalkulation, Reporting, Im-/Export, Abrechnung und Sicherheits-/DSGVO-Funktionen werden um eine Postgres-RLS-geschützte Organisation geführt.

## 3. Architektur und technische Grundlage

| Ebene | Befund |
|---|---|
| Frontend | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui-basierte lokale Komponenten, Lucide-Icons, Sonner. |
| Datenzugriff | Prisma 6 auf PostgreSQL. Geldwerte liegen je nach Generation des Modells als Cents (`Int`) oder Buchhaltungs-Decimal (`Decimal(12,2)`) vor. |
| Auth | Auth.js v5 mit Credentials (E-Mail/Passwort) und optionalem Google-Provider, JWT-Session mit sieben Tagen Laufzeit. |
| Sicherheitsbasis | argon2id-Passwortprüfung, verschlüsseltes TOTP-Secret, gehashte Recovery-Codes, AES-256-GCM für Zugangsdaten, AuditLog und RLS. |
| Mandantenisolation | `organization_id` auf Mandantendaten; `tenantDb(orgId)` setzt pro Transaktion `app.current_org_id`; PostgreSQL-RLS ist aktiviert und forciert. |
| Bypass | `bypassDb()` setzt `app.bypass_rls = on`, gedacht nur für systemische Vor-Tenant-Flows wie Login, Registrierung und Einladung. |
| Billing | Stripe Checkout/Kundenportal/Webhook plus Demo-Upgrade-Code; Tiers FREE, PRO, BUSINESS. |
| Dateien | JPG/PNG/WebP bis 5 MB; Supabase Storage wenn konfiguriert, sonst lokaler Fallback unter `public/uploads/<orgId>`. |
| Tests | Vitest-Dateien für Berechnung, Kryptografie sowie Inventar-, Einkaufs-, Verkauf-, Storno-, Retoure-, Konsignation-, Schulden-, Dokumentnummer- und Import-Domains. |

## 4. Routeninventar

### Öffentliche, Auth- und rechtliche Routen

| Route | Zweck | Status |
|---|---|---|
| `/` | Marketing-/Landingpage | UI sichtbar, Funktion nicht vollständig validiert |
| `/pricing` | Preise, Planwahl und Upgrade-Einstieg | UI sichtbar, Funktion nicht vollständig validiert |
| `/about`, `/agb`, `/datenschutz`, `/impressum` | Öffentliche Unternehmens-/Rechtsseiten | UI sichtbar, Funktion nicht vollständig validiert |
| `/login` | Credentials-Login, bedingtes TOTP-/Recovery-Code-Feld | Im Browser sichtbar und anonym geladen |
| `/registrieren` | Konto + erste Organisation anlegen | UI sichtbar, Funktion nicht vollständig validiert |
| `/einladung/[token]` | Einladungsannahme, ggf. Konto mit Passwort anlegen | UI sichtbar, Funktion nicht vollständig validiert |

### Geschützte interne SaaS-Routen

Alle folgenden Routen liegen im `(app)`-Bereich. Middleware verlangt eine Session und aktive Mitgliedschaft; OWNER/ADMIN ohne aktiviertes 2FA werden auf `/einstellungen/sicherheit?pflicht=1` umgeleitet.

| Route | Modul / Hauptzweck | Tarifgrenze |
|---|---|---|
| `/dashboard` | KPI-Cockpit, Charts, Warnungen, jüngste Verkäufe, offene Schulden und für Manager Audit-Aktivität | keine Route-Grenze |
| `/lager` | Eigenbestand, neue Einkaufs-/Bestandspositionen und Legacy-Lager | keine Route-Grenze |
| `/produkte` | Produktkatalog | keine Route-Grenze |
| `/verkauf` | Verkaufsanlage, Allokationen, Finanz-/Versand-/Auszahlungsansichten und Storno | keine Route-Grenze |
| `/retouren` | Relationale Retouren und Bestandsworkflow | keine Route-Grenze |
| `/konsignation` | Fremd-/Konsignationsbestand | BUSINESS |
| `/schulden` | Forderungen/Verbindlichkeiten und Ausgleich | keine Route-Grenze |
| `/aufgaben` | Kanban-Aufgaben | keine Route-Grenze |
| `/versand` | Versandtarife und Tarifkalkulation | PRO |
| `/zugangsdaten` | verschlüsselter Zugangsdaten-Tresor | BUSINESS |
| `/team` | Mitglieder und Einladungen | keine Route-Grenze |
| `/einstellungen` | Organisation, Billing, Stammdaten, Steuer, Datenschutz | keine Route-Grenze |
| `/einstellungen/sicherheit` | TOTP-Setup/-Deaktivierung | keine Route-Grenze; trotz 2FA-Pflicht erreichbar |

### API-Routen

| Route | Methode | Verhalten |
|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | Auth.js-Handler für Login/Session/Provider-Flows. |
| `/api/export/[table]` | GET | CSV oder XLSX für `lager`, `verkauf`, `retouren`, `konsignation`, `schulden`, `aufgaben`; benötigt Session + aktive Mitgliedschaft. |
| `/api/stripe/webhook` | POST | Prüft Stripe-Signatur und setzt Organisationstier bei Checkout/Subscription-Änderung oder -Löschung. |

## 5. Rollen, Tenant-Regeln und Sicherheitsmodell

### Rollen

`READONLY < MEMBER < ADMIN < OWNER`. `requireOrg(minRole)` prüft bei einer Server-Aktion die Session und die Mitgliedschaft erneut gegen die Datenbank und gibt erst dann den tenant-gescopten Client zurück.

| Rolle | Nachgewiesene Bedeutung |
|---|---|
| READONLY | Standardlesezugriff auf geschützte Seiten; schreibende Actions verlangen überwiegend mindestens MEMBER. |
| MEMBER | Operative Anlage/Änderung von Lager, Verkauf, Retoure, Konsignation, Schulden, Versand, Aufgaben und Produkten. |
| ADMIN | Zusätzlich Organisations-/Stammdaten, Plattformen/Optionen/Steuer, Teamverwaltung, Löschen vieler Objekte und Zugangsdaten-Tresor. |
| OWNER | Zusätzlich Billing, DSGVO-Export und Organisationslöschung. |

**Wichtig:** OWNER und ADMIN benötigen TOTP. Ein MEMBER/READONLY kann TOTP nach erfolgreicher Verifikation deaktivieren; für Nutzer mit mindestens einer OWNER-/ADMIN-Mitgliedschaft ist Deaktivierung blockiert.

### Mandantentrennung

- Mandantenmodelle besitzen `organizationId` / Spalte `organization_id`, Indizes und RLS-Policies gegen `current_setting('app.current_org_id')`.
- RLS wird in den Migrationen mit `ENABLE ROW LEVEL SECURITY` und `FORCE ROW LEVEL SECURITY` gesetzt.
- Der normale Prisma-Basisclient hat ohne Kontext auf Mandantentabellen keinen fachlichen Zugriff; alle Business-Queries sollen über `tenantDb` laufen.
- `bypassDb()` existiert bewusst für Auth-/Registrierungs-/Einladungs-Querschnittsoperationen. Seine Verwendung für nutzergetriebene Fachdatenschreibvorgänge wäre ein Sicherheitsrisiko; im geprüften Domänenpfad ist dies nicht nachgewiesen.
- Der API-Tabellenexport prüft Mitgliedschaft, aber keine explizite Mindestrolle. Somit ist er nach aktuellem Code für jede aktive Mitgliedschaft einschließlich READONLY erreichbar. Ob das Produktseitig gewollt ist: **Unklar / muss verifiziert werden**.

### Weitere Schutzmechanismen

- In-Memory Sliding-Window-Limiter in Middleware: `/api/auth/*` 20 Requests/Minute/IP, sonst 300 Requests/Minute/IP. Bei horizontaler Skalierung nicht geteilt; der Code nennt Redis/Upstash als spätere Alternative.
- Credentials: unbekannte E-Mail führt ebenfalls eine argon2-Prüfung gegen einen Dummy-Hash aus.
- TOTP: Zeitfenster-Toleranz ±1; zehn nur einmalig im Klartext ausgegebene Recovery-Codes, anschließend argon2-gehasht.
- Credential-Tresor: Secret verschlüsselt gespeichert; Reveal, Anlage und Löschung benötigen ADMIN und schreiben Audit-Events.
- Stripe-Webhook verarbeitet nur signaturvalidierte Events; ohne Stripe-Konfiguration antwortet er mit 503.

## 6. Datenmodell, Tabellen und Felder

Die Prisma-Namen sind in Klammern die physischen Tabellen. Aufgelistet sind fachliche Felder; technische Primärschlüssel und Zeitstempel (`id`, `createdAt`, `updatedAt`) sind enthalten, wenn sie für die Interpretation wichtig sind.

### 6.1 Identität, Organisation und Konfiguration

| Modell (Tabelle) | Felder / Beziehungen | UI-/Fachbezug |
|---|---|---|
| `Organization` (`organizations`) | `name`, eindeutiger `slug`, `legalForm`, USt-/Steuernummer, Adresse, `orderIdFormat`, Legacy-Counter, `lowStockThreshold`, `subscriptionTier`, Stripe-Customer/-Subscription-ID | Einstellungen, Registrierung, Billing, alle Mandantenbezüge. |
| `User` (`users`) | eindeutige `email`, `name`, `image`, `passwordHash`, `totpSecret`, `totpEnabled`, `recoveryCodes`, `theme` | Login, Account, Theme, TOTP. Nie Klartext-Passwort. |
| `Membership` (`memberships`) | `organizationId`, `userId`, `role`; unique pro Org/User | Rollen- und aktiver-Tenant-Bezug. |
| `Invitation` (`invitations`) | Organisation, E-Mail, Zielrolle, eindeutiger Token, Status, Einladender, Ablauf-/Annahmezeit | Team-Einladungsflow. |
| `Platform` (`platforms`) | Name, optionale URL, Default-Gebührensatz, aktiv | Plattformstamm; Verkauf und Listings. |
| `Carrier` (`carriers`) | Name, Tracking-URL-Template, aktiv | Im Datenmodell vorhanden, UI-Verfügbarkeit unklar; Versandseite nutzt primär `ShippingRate`. |
| `ShippingRate` (`shipping_rates`) | Dienstleister, Tarifname, Zone, Länder-Array, Grund-/kg-Preis, max. Gewicht, JSON-Zuschläge, aktiv | `/versand`, Vorschlag/Kalkulation im Verkaufsdialog. |
| `TaxRate` (`tax_rates`) | Name, Prozentsatz, optionales Land, Default-Flag | Einstellungen, Kalkulation von EK/VK/Retouren. |
| `SelectOption` (`select_options`) | `kind` (PAYMENT_METHOD, PAYOUT_RECIPIENT, TASK_AREA), Label, Sortierung, aktiv | Konfigurierbare ZM, Auszahlungsempfänger und Aufgabenbereiche. |
| `DocumentSequence` (`document_sequences`) | Organisation, `DocumentKind`, Jahr, atomar erhöhter `value`; unique Org/Art/Jahr | Nummern L, K, E, V, R, SCH. |

### 6.2 Legacy-Warenwirtschaft (weiter produktiv lesbar/bearbeitbar)

| Modell (Tabelle) | Felder / Beziehungen | Einordnung |
|---|---|---|
| `StockItem` (`stock_items`) | SKU, Titel/Modell, Variante, Beschreibung, Kategorie, Marke, Größe, Zustand, EAN, Menge, Händler, EK brutto/netto, VSt, Zahlungsmethode, Kaufdatum/-kanal, Lagerplatz, Lager-/Kauf-/Retourenstatus, Bilder, Notizen, Steuersatz | Legacy-Lagerdaten. Neue eigene Zugänge werden laut Domain-Dokumentation über Purchase/InventoryPosition geschrieben. |
| `StockItemListing` (`stock_item_listings`) | `stockItemId`, `platformId`, Organisation; unique Artikel/Plattform | Legacy-Listing-Zuordnung. |
| `SaleItem` (`sale_items`) | `saleId`, optional `stockItemId` oder `consignmentId`, EK-Netto-Snapshot | Legacy-Verkaufsposition; neue Verkäufe nutzen SaleLine/Allocation. |
| `ConsignmentInventory` (`consignment_inventory`) | eigene SKU, optionale Stock-/Sale-Links, Einlieferer/Kontakt, Artikeltitel, Bestandszähler, Preisstaffeln JSON, verknüpfte Verkäufe, Provision/vereinbarte Auszahlung, Empfang-/Verkauf-/Auszahl-/Rückgabezeit, Status, Notizen | Legacy-Konsignation. Neue Zugänge verwenden InventoryPosition + ConsignmentLot. |

### 6.3 Neuer Einkaufs- und Inventarkern

| Modell (Tabelle) | Felder / Beziehungen | Einordnung |
|---|---|---|
| `Product` (`products`) | Name, Marke, Variante, Größe, Kategorie, EAN, Standard-EK, Bilder; unique Organisation/Name/Variante | Katalog; Bezug für PurchaseLine, InventoryPosition, SaleLine. |
| `Purchase` (`purchases`) | `purchaseNumber`, Datum, Lieferant, Zahlungsmethode, Status (DRAFT/CONFIRMED/CANCELLED), Kommentar, Ersteller | Neuer Einkaufsbeleg; schafft bei Anlage Lines/Lots/Positionen. |
| `PurchaseLine` (`purchase_lines`) | Kauf, Produkt, Menge, Stück-/Gesamtpreis brutto/netto, VSt, Kommentar | Detailzeile und Quelle eines Owned-Lots. |
| `InventoryPosition` (`inventory_positions`) | Produkt, `inventoryType` OWNED/CONSIGNMENT, L-/K-Nummer, `quantityReceived`, `quantityAvailable`, `quantityReserved`, `quantityInspection`, `quantityDefective`, `quantitySold`, aktiv, Empfangsdatum | Gemeinsame Bestandsbasis. Mengen werden über Movements geführt. |
| `OwnedStockLot` (`owned_stock_lots`) | eindeutige Position, optionale PurchaseLine, Kaufdatum, Lieferant, brutto/netto, VSt, Zahlungsmethode, Buchungsstatus, EAN, Bilder, Legacyquelle | OWNED-Spezialisierung, genau eine pro Position. |
| `ConsignmentLot` (`consignment_lots`) | eindeutige Position, Partner, externe SKU, Identnummer, EK brutto/netto, Endbetrag, Versand, reale OVP, Kanalpreise JSON, Kommentar, Legacyquelle | CONSIGNMENT-Spezialisierung, genau eine pro Position. |
| `InventoryPositionListing` (`inventory_position_listings`) | Position, Plattform, Organisation; unique Position/Plattform | Neue Listing-Zuordnung. |
| `InventoryMovement` (`inventory_movements`) | Position, Movement-Typ, positive Menge, Quell-/Ziel-Bucket, Referenztyp/-ID/-aktion, Idempotenzschlüssel, Kommentar, Ersteller | Unveränderliche Bewegungsbasis für Mengen; unique Organisation/Idempotenzschlüssel. |

**Buckets:** AVAILABLE, RESERVED, INSPECTION, DEFECTIVE.  
**Movement-Typen:** PURCHASE_RECEIPT, CONSIGNMENT_RECEIPT, SALE_OUT, RESERVE, RELEASE_RESERVATION, RETURN_RECEIPT, RETURN_RESTOCK, RETURN_DEFECTIVE, ADJUSTMENT_IN, ADJUSTMENT_OUT, REVERSAL.

### 6.4 Verkauf und Retoure

| Modell (Tabelle) | Felder / Beziehungen | Einordnung |
|---|---|---|
| `Sale` (`sales`) | optionaler Legacy-Stock-Bezug, Plattform/Carrier/Steuer, Verkaufsdatum, Menge, VK brutto/netto, Steuersatz, Marge/Gewinn, Käuferland, Versandart/-kosten, Plattform-/Zahlungsgebühr, Rechnung/Porto/Gebühren gebucht, Käufer, Ordernummer, Tracking, Status, Relation-Qualität, Notizen | Kopf des Verkaufs; neue Nummer V-YY-NNNN wird im Feld `orderNumber` genutzt. |
| `SaleLine` (`sale_lines`) | Sale, Produkt, Beschreibungs-/Varianten-/Größen-Snapshot, Menge, Einzel-/Gesamtpreis brutto/netto, Kommentar | Neue belegsichere Positionen. |
| `SaleLineAllocation` (`sale_line_allocations`) | SaleLine, InventoryPosition, Menge, EK-Netto-Snapshot, Inventory-Typ-Snapshot, optionaler Konsignations-Endbetrag-Snapshot | Bestands- und Kostenbezug; erlaubt FIFO für OWNED und explizite K-Positionen für CONSIGNMENT. |
| `Return` (`returns`) | optionale R-Nummer, Sale, Meldung-/Eingangsdatum, Grund, Erstattung, Rückversand/Zusatzkosten, Verlust, Status, restocked, Notizen | Kopf einer Retoure; alte Retouren bleiben kompatibel. |
| `ReturnLine` (`return_lines`) | Retoure, SaleLine, Menge, Problemtyp, Zustand, Erstattung/Zusatzkosten, Kommentar | Mengenbezogener Retourenbezug. |
| `ReturnAllocation` (`return_allocations`) | ReturnLine, SaleLineAllocation, Menge, IDs der Receive/Restock/Defective-Movements | Verankert die Retoure in der ursprünglich verkauften Bestandsposition und verhindert doppelte Workflowbuchung. |

### 6.5 Schulden, Aufgaben, Credentials, Audit und Import

| Modell (Tabelle) | Felder / Beziehungen | Einordnung |
|---|---|---|
| `Debt` (`debts`) | optionale SCH-Nummer, Datum, Legacy-`refId`, `DebtType`, `DebtKind`, Menge, Buchungsmarker, Gläubiger/Schuldner, Betrag/bezahlt, Beschreibung, Fälligkeit, Status, Begleichdatum, Notizen | Manuelle und automatisch verknüpfte Schulden. |
| `DebtPurchaseLink` (`debt_purchase_links`) | eindeutig Debt ↔ Purchase | Eine Schuld pro Einkauf. |
| `DebtSaleLink` (`debt_sale_links`) | eindeutig Debt ↔ Sale | Eine Schuld pro Verkauf. |
| `DebtInventoryLink` (`debt_inventory_links`) | Debt ↔ InventoryPosition, unique Paar | Ergänzende/historische Bestandsbezüge. |
| `Task` (`tasks`) | Titel, Beschreibung, Bereich, Status, Priorität, archiviert, Frist, Bearbeiter, Ersteller, Abschlusszeit | Kanban-Aufgabe. |
| `Credential` (`credentials`) | Label, optionaler Username/Plattform, `secretEncrypted`, Notizen, Rotationstermin | Verschlüsselter Vault; Secret nicht im Klartext exportiert. |
| `AuditLog` (`audit_logs`) | Organisation, optionaler User, Aktion, Entitytyp/-ID, vorher/nachher JSON, IP, Zeit | Aktivitäts-/Nachweisprotokoll. |
| `ImportBatch` (`import_batches`) | Dateiname, Datei-Hash, Importart, Status, Start/Ende, Ersteller, JSON-Summary | Nachvollziehbare Importausführung/Dry Run. |
| `SourceReference` (`source_references`) | ImportBatch, Sheet, Zeile, Row-Hash, Zielentität/-ID, Legacyreferenz, Row-Status, Warnungen/Fehler | Provenienz und Duplikatschutz auf Zeilenebene. |

### 6.6 Auth.js-Adaptertabellen

| Modell (Tabelle) | Felder |
|---|---|
| `Account` (`accounts`) | `userId`, Typ, Provider, Provider-Account-ID, Refresh-/Access-Token, Ablauf, Token-Typ, Scope, ID-Token, Session-State. |
| `Session` (`sessions`) | eindeutiger Sessiontoken, `userId`, Ablauf. |
| `VerificationToken` (`verification_tokens`) | Identifier, eindeutiger Token, Ablauf; unique Identifier/Token. |

Sie gehören zur Auth-Infrastruktur und sind **Im Datenmodell vorhanden, UI-Verfügbarkeit unklar**.

### 6.7 Status-/Enum-Katalog

- Rollen: OWNER, ADMIN, MEMBER, READONLY.
- Rechtsformen: GBR, EINZELUNTERNEHMEN, UG, GMBH, SONSTIGE.
- Legacy-Lagerstatus: IN_STOCK, STORED_R, STORED_D, SOLD, RETURNED, CANCELLED, IN_TRANSIT, OTHER sowie Altwerte LISTED/RESERVED/WRITTEN_OFF.
- Buchungsstatus: E, O, NN, S.
- Verkäufe: PENDING, PAID, SHIPPED, COMPLETED, CANCELLED, REFUNDED.
- Retouren: REQUESTED, REJECTED, RESTOCKED, REFUNDED, CONFLICT sowie Altwert RECEIVED.
- Konsignation: RECEIVED, LISTED, SOLD, PAID_OUT, RETURNED.
- Schulden: OPEN, SETTLED, OTHER sowie Altwert PARTIALLY_PAID; Typ PURCHASE/SALE/MANUAL/OTHER; Kind KAUF/VERKAUF/SONSTIGES.
- Aufgaben: OPEN, IN_PROGRESS, DONE, CANCELLED; LOW, MEDIUM, HIGH, URGENT.
- Import: DRY_RUN, RUNNING, COMPLETED, FAILED und Zeilen-/Relationsqualitätsstatus einschließlich LINKED, PARTIALLY_LINKED, UNRESOLVED, REVIEW_REQUIRED, CONFLICT, ERROR.

## 7. Module und vorhandene Bedienoberflächen

### 7.1 Dashboard und Reporting

**Code- und Schema-basiert nachgewiesen.** `/dashboard` lädt einen Zeitraumfilter sowie:

- KPIs für Umsatz, Gewinn, Verkäufe, offene Retouren, Lagerbestand/Transit, offene Rechnungen und fällige Aufgaben.
- Schulden-Salden nach Person.
- Quartalsvergleich Umsatz, monatlichen Einkauf-vs.-Verkauf-Flow, Plattformanteile und Top-10-Produkte nach Gewinn (Recharts).
- Letzte Verkäufe, offene Schulden, Niedrigbestandswarnungen auf Basis von `lowStockThreshold`.
- Für ADMIN/OWNER eine gefilterte jüngste Audit-Aktivität und Akteursauswahl.

**Grenze:** Dashboarddaten werden serverseitig berechnet, aber **UI sichtbar, Funktion nicht vollständig validiert** mit realen Organisationsdaten.

### 7.2 Lager und Wareneingang

**UI sichtbar, Funktion nicht vollständig validiert.** `/lager` kombiniert Legacy- und neue Inventory-Positionen in `StockTable`, Filterbar, Detail-Drawer, Spaltenansichten und `ImportExportBar`.

- Anlage über `StockItemDialog`: Kaufdatum, Händler, Produkt/Modell, Variante, Größe, EK brutto, EAN, Zahlungsmethode, VSt, Status, Kauf-/Retourenbuchung, Menge, Plattformen, Bild und Notiz.
- Neuer OWNED-Pfad: `createStockItemAction` nutzt `createOwnedPurchase` → Purchase/PurchaseLine/InventoryPosition/OwnedStockLot/`PURCHASE_RECEIPT`.
- Neben dem neuen Kern bleiben Legacy-StockItems editierbar; Bulk-Update, Status-/Buchungsstatusänderung und Listing-Toggle existieren.
- Neue Positionen können Listing-Relationen und Buchungsstatus ändern; Mengenanpassung soll über `adjustOwnedInventoryQuantityAction` und InventoryMovement laufen.
- Niedrigbestand kann über Einstellungen konfiguriert werden.

**Nicht neu bauen:** Inventarbewegung, Dokumentnummern L/E, OWNED-Chargen, Bilder, Plattform-Listings, Filter/Bulk-Update und Detailansicht existieren bereits.

### 7.3 Produktkatalog

**UI sichtbar, Funktion nicht vollständig validiert.** `/produkte` zeigt Name, Variante/Version, Kategorie, EAN, Standard-EK und Bild; Dialog erlaubt Anlegen/Bearbeiten/Löschen.

- Felder: Name, Variante, Kategorie, EAN, Standard-EK, Bild. Das Model enthält zusätzlich Marke und Größe; die sichtbare Verfügbarkeit dieser zwei Felder ist im geprüften Dialog nicht nachgewiesen.
- Server Actions: `createProductAction`, `updateProductAction`, `deleteProductAction` (MEMBER).

### 7.4 Verkauf

**UI sichtbar, Funktion nicht vollständig validiert.** `/verkauf` ist ein Mehrpositions-Verkaufsmodul mit Ansichten Standard/Buchhaltung/Versand/Auszahlung/Alle.

- Tabellenspalten: Verkaufs-/V-Nummer, Datum, Artikel, Menge, VK brutto, Steuer, VK netto, EK netto, Gebühren, Versand, Gewinn, Marge, Plattform, Status, Rechnung, Versandart, Land, Auszahlung, Schuldstatus, Aktionen.
- Anlage: Auswahl verkaufbarer L-/K-Positionen mit Mengen; Datum, VK, Plattform, Käuferland, Versandtarif/-kosten, Gebühren inkl./exkl. USt, Auszahlungsempfänger, Status, Rechnung und Kommentar.
- Neuer Domänenpfad: `createInventorySale` erzeugt `Sale`/`SaleLine`/`SaleLineAllocation`, `SALE_OUT`-Movements und bei privatem Auszahlungsempfänger ggf. eine Verkaufsschuld. OWNED wird nach dokumentierter Regel FIFO geplant; Konsignation muss eindeutig gewählt werden.
- Storno: nur neue Verkäufe mit Lines, via `cancelInventorySale` und reversierten SALE_OUT-Movements; Legacy-Verkäufe sind nicht automatisch stornierbar.
- Editieren, Status und Rechnungsflag existieren zusätzlich.

### 7.5 Retouren

**UI sichtbar, Funktion nicht vollständig validiert.** `/retouren` bietet Ansichten Standard/Finanzen/Workflow/Alle.

- Tabellenspalten: R-Nummer, Meldedatum, Verkauf, Artikel, Menge, Problem, Erstattung, Zusatzkosten, Verlust, Status, Aktionen.
- Anlage beginnt mit Verkaufssuche und auswählbaren, noch retournierbaren SaleLineAllocations; danach Meldedatum, Problemart, Ursache, Disposition, Erstattung, Zusatzkosten und Kommentar.
- Workflowaktionen: **Angekommen** (`RETURN_RECEIPT` → INSPECTION), **Weiterverkaufbar** (`RETURN_RESTOCK` → AVAILABLE), **Defekt** (`RETURN_DEFECTIVE` → DEFECTIVE). Movement-IDs und Idempotenz schützen gegen Doppelbuchung.
- Legacy-Retouren bleiben sichtbar/editierbar, werden jedoch nicht automatisch in den Movement-Workflow überführt.

### 7.6 Konsignation

**UI sichtbar, Funktion nicht vollständig validiert; BUSINESS-Route.** `/konsignation` zeigt K-Nummer, Partner, Artikel, Bestand, verkauft, Prüfung, defekt, EK, Status und Aktionen.

- Dialogfelder: Partner/Kontakt, Name, Marke, Variante, EAN, externe SKU, Identifikation, Kategorie, Eingangs-/verfügbare/verkaufte/Prüf-/Defektmengen, EK, Endbetrag, Versand, reale OVP, Kommentar.
- Neuer Pfad: `createConsignmentStock` erstellt Produkt bei Bedarf, K-Position, ConsignmentLot und `CONSIGNMENT_RECEIPT`.
- Zeilenaktionen erlauben Metadaten ändern, Bestandskorrektur mit Begründung und ADMIN-Löschen. Separate direkte Verkaufs-/Retouren-/Defekt-Buttons sind nach Agent-Regel bewusst nicht vorgesehen; diese Bewegungen laufen über Verkauf bzw. Retouren.
- `linkConsignmentSalesAction` bleibt als Legacy-Verknüpfung vorhanden.

### 7.7 Schulden

**UI sichtbar, Funktion nicht vollständig validiert.** `/schulden` bietet Standard-/Buchhaltungs-/Alle-Ansichten und CSV/XLSX-Import/-Export.

- Tabelle: Datum, SCH-Nummer, Bezug, Beschreibung, Art, Menge, Betrag, Schuldner, Empfänger, Status, Eintrag, Beglichen am, Kommentar, Aktionen.
- Manuelle Anlage/Edit: Datum, Legacybezug, Kind, Beschreibung, Menge, Betrag, Parteien, Status, Eintrag, Begleichdatum, Notiz.
- Automatik: ein Purchase mit Zahlungsmethode Richard/Daniel erzeugt eine Purchase-Schuld; Sale mit passendem privatem Auszahlungsempfänger eine Sale-Schuld. Der zentrale Debt-Service ist über eindeutige Links idempotent.
- SETTLED setzt `settledAt` und `paidCents`, ohne den Ursprungsbeleg zu verändern.

### 7.8 Aufgaben

**UI sichtbar, Funktion nicht vollständig validiert.** `/aufgaben` ist ein Kanban-Board mit Filter auf Mitglied und Archivstatus.

- Anlagefelder: Aufgabe, Anmerkung, Bereich, Priorität, Frist, Zuständigkeit.
- Statuswechsel zwischen OPEN/IN_PROGRESS/DONE/CANCELLED, Archivierung statt Löschen; Mitgliederauswahl kommt aus Memberships.
- Import/Export ist vorhanden.

### 7.9 Versand

**UI sichtbar, Funktion nicht vollständig validiert; PRO-Route.** `/versand` verwaltet Tarife, nicht die Ausführung echter Carrier-Labels.

- Tariffelder: Dienstleister, Tarifname, Zone, ISO-2-Länder, Grundpreis, Kilopreis, maximales Gewicht, JSON-Zuschläge und Aktiv-Flag.
- `suggestShipping` berücksichtigt Land, Gewicht und Zuschläge; Verkauf kann aktive Tarife verwenden.
- Kein nachgewiesener Carrier-Label-Kauf, Tracking-Abfrage oder Versandmanifest-Export.

### 7.10 Team, Organisation und Einstellungen

**UI sichtbar, Funktion nicht vollständig validiert.**

- `/team`: Mitglieder mit Name/E-Mail/Rolle; Einladungen mit Ablauf; ADMIN kann einladen, widerrufen, Rolle ändern und Mitglieder entfernen. OWNER-Steuerung im Einladungsdialog ist vorhanden.
- Organisation: Firmenname, Rechtsform, USt-ID, Steuernummer, Straße, PLZ, Ort und Lagerwarnschwelle.
- Stammdaten: Plattformen aktivieren/anlegen, Zahlungsmethoden, Auszahlungsempfänger, Aufgabenbereiche, Umsatzsteuersätze und Order-ID-Format verwalten.
- Darstellung: persistierbares Theme pro User und System/hell/dunkel-Unterstützung.
- Sicherheit: TOTP-Setup mit QR-Code und Recovery-Codes.
- Daten & DSGVO: OWNER kann JSON-Export auslösen und Organisation nach exakter Namensbestätigung löschen.

### 7.11 Zugangsdaten-Tresor

**UI sichtbar, Funktion nicht vollständig validiert; BUSINESS-Route.**

- Tabelle: Label, Benutzername, Plattform, Secret (maskiert), zuletzt geändert.
- Anlage: Label, Benutzername, optionale Plattform, Secret, Notiz.
- ADMIN kann Secret aktiv offenlegen und löschen; beide Aktionen werden auditiert.
- DSGVO-Export selektiert Credential-Metadaten ohne `secretEncrypted` und ohne Klartextsecret.

### 7.12 Billing

**Code- und UI-basiert nachgewiesen, externe Zahlungsabwicklung nicht validiert.**

- FREE: Lager/Wareneingang, Verkauf, Retouren, Aufgaben, Schulden, bis zwei Teammitglieder (Produktbeschreibung/Planmatrix).
- PRO: Reporting, Versandtarife, unbegrenztes Team (Planmatrix).
- BUSINESS: Konsignation, Vault, DSGVO-Export/Audit (Planmatrix).
- OWNER kann Stripe Checkout/Portal und Code-Upgrade nutzen. Webhook setzt den Tierstatus.
- Ob Stripe-Keys, Price-IDs, Webhook-Secret oder Demo-Code in der Zielumgebung konfiguriert sind: **Unklar / muss verifiziert werden**.

## 8. Kernworkflows und Automationen

### 8.1 Eigener Wareneingang

`Produkt → Purchase (E-YY-NNNN) → PurchaseLine → InventoryPosition(OWNED, L-YY-NNNN) → OwnedStockLot → PURCHASE_RECEIPT`.

Der Service prüft/plant Mengen, schreibt Audit-Einträge und kann bei Zahlungsmethode Richard/Daniel automatisch eine verknüpfte Purchase-Schuld anlegen. Unterschiedliche Einkaufsbedingungen bleiben getrennte PurchaseLine-/Lot-Einheiten.

### 8.2 Bestandsführung

`InventoryMovement` ist der maßgebliche neue Bestandsledger. Die zentrale Service-API umfasst Zugang, Konsignationszugang, Reservierung/Freigabe, Verkauf, Retoureneingang, Wiedereinlagerung, Defekt, Korrektur, Reversal und Timeline. Invarianten laut Domänendokumentation: keine negativen Buckets, positive Movement-Mengen, sichere Entnahme, idempotente Schlüssel und transaktionales Rollback.

### 8.3 Verkauf, Marge und Schuld

`Sale → SaleLine → SaleLineAllocation → SALE_OUT`.

- Kosten-/Produktinformationen werden als Snapshots gespeichert, damit spätere Stammdatenänderungen alte Belege nicht verfälschen.
- Steuer, Netto, Gebühren, Marge und Gewinn werden serverseitig berechnet (`lib/calculations.ts`).
- Bei passendem privaten Auszahlungsempfänger kann eine SALE-Schuld entstehen.
- Storno macht die zugehörigen Bewegungen reversibel, nicht aber Legacy-SaleItems.

### 8.4 Retoure

`Return → ReturnLine → ReturnAllocation → ursprüngliche SaleLineAllocation`.

REQUESTED verändert den Bestand nicht. RECEIVE, RESTOCK und DEFECTIVE erzeugen die jeweiligen Bewegungen. Die Allokationsmengen dürfen die noch nicht retournierte Verkaufsmenge nicht übersteigen.

### 8.5 Konsignation

`Product → InventoryPosition(CONSIGNMENT, K-YY-NNNN) → ConsignmentLot → CONSIGNMENT_RECEIPT`.

Konsignation wird getrennt erfasst, aber im selben neuen Inventarledger geführt. Konsignierte Ware wird beim Verkauf explizit allokiert und bei Retoure im gleichen Retourenprozess gebucht.

### 8.6 Dokumentnummern

`DocumentNumberService` reserviert jahr-/mandantenbezogene Werte atomar. Präfixe: L (OWNED), K (CONSIGNMENT), E (PURCHASE), V (SALE), R (RETURN), SCH (DEBT). Sichtbare Nummern sind keine Primärschlüssel.

### 8.7 Importmigration

`ImportBatch` + `SourceReference` bilden eine nachvollziehbare Pipeline:

- CSV/XLSX-Upload mit Headererkennung, Alias-Mapping und Dry Run im UI.
- Row-Hashes verhindern stille Doppelimporte.
- Tabellen: Lager, Verkauf, Retouren, Konsignation, Schulden, Aufgaben.
- Historische Verkäufe können als LINKED, PARTIALLY_LINKED, UNRESOLVED oder REVIEW_REQUIRED klassifiziert sein; 2024/2025 dürfen fürs Reporting importiert werden, auch ohne eindeutigen Bestandbezug.
- Legacyfelder bleiben bewusst für historische Anzeige, Export und Review erhalten.

### 8.8 Export, DSGVO und Löschung

- Tabellenauszug: CSV oder XLSX, semikolongetrennt mit BOM für deutsches Excel; API exportiert die sechs Legacy-Haupttabellen mit Filterparametern.
- Datenschutzexport: JSON der Organisation, Memberships, Einladungen, Plattformen, Carrier, Steuern, Versandtarife, **Legacy**-StockItems/-Listings, Sales, Returns, Legacy-Konsignation, Debts, Tasks, Credential-Metadaten und AuditLogs.
- Organisationslöschung: OWNER, exakte Namensbestätigung, DB-Kaskaden, lokaler Upload-Ordner, Abmeldung.

**Wichtiger Befund:** Der dokumentierte DSGVO-Export lädt nicht `Product`, `Purchase`, `PurchaseLine`, `InventoryPosition`, Lots, Movements, SaleLines/-Allocations, ReturnLines/-Allocations, DebtLinks, ImportBatches oder SourceReferences. Für Daten, die ausschließlich im neuen Kern liegen, ist der DSGVO-Export damit **nicht nachweislich vollständig**. Dies ist ein Prioritäts-Befund für die fachliche und rechtliche Verifikation, keine Aufforderung zur unmittelbaren Änderung.

## 9. Server Actions und Services

### Server Actions nach Fachbereich

| Datei | Öffentliche Funktionen |
|---|---|
| `actions/register.ts` | `registerAction`, `createOrganizationAction` |
| `actions/invitation.ts` | `getInvitation`, `acceptInvitationAction` |
| `actions/team.ts` | `inviteMemberAction`, `revokeInvitationAction`, `updateMemberRoleAction`, `removeMemberAction` |
| `actions/stock.ts` | `createStockItemAction`, Status-/Buchungsstatus-/Listing-Updates, `adjustOwnedInventoryQuantityAction`, Legacy-Edit, `bulkUpdateStockAction` |
| `actions/products.ts` | create/update/delete Product |
| `actions/sales.ts` | create/update/cancel Sale, Sale-Status, Rechnung-Flag |
| `actions/returns.ts` | create Return, Workflow anwenden, Status-/Edit-Update |
| `actions/consignment.ts` | create/edit/delete Konsignation, Mengen-/Bestandskorrektur, Legacy-Verkaufslinks |
| `actions/debts.ts` | create/update Debt, Status, Eintrag, delete |
| `actions/tasks.ts` | create, move, archive, bearbeitbare Mitglieder laden |
| `actions/import.ts` | `importRowsAction`, Inventory-Optionen für Import |
| `actions/shipping.ts` | create/update/toggle/delete ShippingRate |
| `actions/catalog-settings.ts` | Plattform anlegen/toggle, Select-Optionen anlegen/entfernen |
| `actions/tax-rates.ts` | upsert/delete TaxRate, Order-ID-Format |
| `actions/organization.ts` | Organisation und Lagerwarnschwelle |
| `actions/theme.ts` | Theme speichern |
| `actions/two-factor.ts` | TOTP starten, bestätigen, deaktivieren |
| `actions/credentials.ts` | Credential anlegen, reveal, löschen |
| `actions/billing.ts` | Stripe Checkout, Portal, Plan-Code |
| `actions/gdpr.ts` | JSON-Export, Organisationslöschung |

### Domänenservices und Hilfsfunktionen

- `inventory-service`: sämtliche Movement-Operationen, Reversal, Timeline, Idempotenz und Bucket-Guards.
- `owned-purchase-service`: Einkaufsplanung und transaktionale Anlage von Purchase/Lot/Position/Movement.
- `sales-service`: Allokationsplanung, Erstellung und Storno neuer Verkäufe.
- `returns-service`: Retourenallokationsplanung und Workflow.
- `consignment-service`: Vorbereitung/Erstellung von Konsignationsbestand.
- `debt-service`: automatische/ manuelle Schulden und Settlement.
- `document-number-service`: Dokumentsequenzen reservieren, formatieren und Vorschau.
- `import-migration-service`: Migrationsimport, Referenzparser, Headererkennung, Gruppierung.
- `reporting`, `calculations`, `activity`, `options`, `audit`, `uploads`, `crypto`, `totp`: Reporting, Finanzformeln, Aktivitätstexte, Optionen, Audit, Bilder, Verschlüsselung und TOTP.

## 10. Import-/Export-Matrix

| Bereich | Import | Tabellenexport | DSGVO-JSON |
|---|---|---|---|
| Lager | CSV/XLSX mit breitem Legacy-Alias-Mapping; neuer Migrationspfad | ja, aus `StockItem` | ja, aber nur Legacy-StockItems/-Listings |
| Verkauf | CSV/XLSX, historische Relationsqualität | ja, aus `Sale` + Legacy `SaleItem` | ja, Sale-Kopf; neue Lines/Allocations nicht explizit geladen |
| Retouren | CSV/XLSX | ja, Return-Kopf | ja, Return-Kopf; neue Lines/Allocations nicht explizit geladen |
| Konsignation | CSV/XLSX | ja, aus Legacy `ConsignmentInventory` | ja, nur Legacymodell; neue ConsignmentLots nicht explizit geladen |
| Schulden | CSV/XLSX | ja, Debt-Kopf | ja, Debt-Kopf; neue DebtLinks nicht explizit geladen |
| Aufgaben | CSV/XLSX | ja | ja |
| Produktkatalog | kein separater UI-Import nachgewiesen | kein separater API-Export nachgewiesen | nicht explizit geladen |
| Neuer Inventory-Ledger | indirekt über Migration/Warenfluss | kein separater API-Export nachgewiesen | nicht explizit geladen |
| Credentials | kein Import | kein Tabellenexport | Metadaten ohne Secret |

## 11. Migrationen und Evolution

| Migration | Inhalt |
|---|---|
| `20260704000000_init` | Initiale SaaS-/Auth-/Mandantenbasis inklusive RLS. |
| `20260704132126_trade_core` | Handelskerndaten. |
| `20260704150000_returns_consignment_debts_tasks` | Retouren, Konsignation, Schulden, Aufgaben. |
| `20260705090000_theme_and_billing` | Theme und Billing. |
| `20260706100000_rework_stock_sales_products` | Umbau Lager, Verkauf, Produkte. |
| `20260706150000_returns_debts_tasks_block2` | Erweiterungen dieser Module. |
| `20260706170000_low_stock_threshold` | Lagerwarnschwelle. |
| `20260706180000_inventory_datamodel_phase1` | Additiver Inventory-/Document-/Purchase-Kern. |
| `20260707120000_inventory_phase1_purchase_created_by_fk` | Purchase-Ersteller-FK. |
| `20260707130000_inventory_movements_phase2` | Bewegungsledger. |
| `20260707140000_owned_purchase_batches_phase3` | Owned Purchase/Lots. |
| `20260708100000_consignment_inventory_positions_phase4` | reale OVP in ConsignmentLot. |
| `20260708110000_sales_lines_allocations_phase5` | SaleLines/Allocations. |
| `20260708120000_return_lines_allocations_phase6` | ReturnLines/Allocations. |
| `20260708130000_debt_relations_phase7` | DebtType und relationale DebtLinks. |
| `20260708140000_import_pipeline_phase8` | ImportBatch/SourceReference und Relationsqualität. |
| `20260709100000_product_brand` | Product.brand. |

Kein Seed-Skript bzw. keine Seed-Datei wurde anhand der Repository-Dateiliste gefunden. **Unklar / muss verifiziert werden**, ob ein Seed extern, per Datenbankdump oder bewusst nicht vorgesehen ist.

## 12. Testabdeckung und Integritätswerkzeuge

| Testdatei | Nachgewiesener Fokus |
|---|---|
| `calculations.test.ts` | Brutto/Netto, Verkauf/Retoure, Steuer, Orderformat, Versandvorschlag, Geldformatierung. |
| `crypto.test.ts` | Verschlüsselung. |
| `document-number-service.test.ts` | Nummernformat und Reservierung. |
| `inventory-service.test.ts` | Ledger-/Movement-Invarianten. |
| `inventory-end-to-end-scenario.test.ts` | zusammenhängendes Inventory-Domänenszenario. |
| `owned-purchase-service.test.ts` | Owned-Purchase-Planung. |
| `sales-service.test.ts`, `sales-cancel-service.test.ts` | Allokation und Storno. |
| `returns-service.test.ts` | Retourenallokation. |
| `consignment-service.test.ts` | Konsignationsplanung. |
| `debt-service.test.ts` | Schuldenregeln. |
| `import-migration-service.test.ts` | Importpipeline. |

`npm run integrity:check` prüft zusätzlich negative Inventarmengen, Spezialisierungsfehler, Allokationsgrenzen, cross-tenant Debt-Links, doppelte Dokumentnummern und Movement-Replay. Er ist ein Datenintegritäts-Gate, ersetzt aber keine vollumfängliche historische Datenprüfung.

## 13. Bereits vorhanden – nicht erneut konzipieren oder bauen

Folgende Fähigkeiten sind nicht nur Ideen, sondern bereits in Code, Datenmodell oder UI verankert:

- echte Multi-Tenancy mit Organisation, Membership, RLS und tenant-gescoptem Datenzugriff;
- Rollenmodell mit OWNER/ADMIN/MEMBER/READONLY und verpflichtendem 2FA für die zwei höheren Rollen;
- Credentials-Login, optionaler Google-Provider, Einladungen, Organisationsgründung und Recovery-Codes;
- Warenledger mit Buckets, Movement-Historie, Reversal und Idempotenz;
- Nummernlogik für Lager, Konsignation, Einkauf, Verkauf, Retoure und Schulden;
- Produktkatalog, Owned-Purchase-Flow, Chargen und Bilder;
- mehrzeilige/allokierte Verkäufe, Margen-/Gewinnberechnung, Steuer-/Gebühren-/Versandwerte und Storno;
- relationale Retouren gegen konkrete SaleLineAllocations;
- Konsignationsbestand im gemeinsamen Inventory-Kern;
- automatische Schulden aus definierten privaten Zahlungs-/Auszahlungsfällen;
- Dashboard/Reporting mit Charts, KPIs, Low-Stock und Auditaktivität;
- Aufgabenboard, Teamverwaltung, Plattform-/Steuer-/Optionsstammdaten;
- Versandtarifkalkulation;
- CSV/XLSX-Import/-Export, Importprovenienz/Dry Run und historischer Relationstatus;
- Stripe-Tiermodell/Feature-Gating, Credential-Tresor, AuditLog, DSGVO-Export/-Löschung und Theme.

## 14. Wettbewerbs-Benchmark: Lücken und Reifegrade

Dies ist eine generische Vergleichsmatrix gegen typische Inventory-/OMS-/Resale-SaaS-Fähigkeiten, kein Vergleich mit einem benannten Anbieter.

| Bereich | Vorhandener Reifegrad | Fehlend oder zu verifizieren |
|---|---|---|
| Multi-Tenant/Rollen/Sicherheit | stark: RLS, Rollen, TOTP, Audit, Verschlüsselung | zentraler, skalierbarer Rate Limiter; Sicherheits-/Berechtigungstests für jede Rolle; Session-/Org-Wechsel-UI **Unklar / muss verifiziert werden**. |
| Inventar | stark im neuen Ledger, Lots, Buckets, Bewegungen | Barcode-Scanning, Lagerplätze/Mehrlager, Inventur/Stocktake, Seriennummern, Batch-/MHD-Management, Mindestbestand-Nachbestellung. |
| Einkauf | Purchase/PurchaseLine/Wareneingang vorhanden | Lieferantenstammdaten mit Bedingungen, Purchase Orders/Freigaben, Wareneingang gegen Bestellung, Rechnungsabgleich, Beschaffungsreporting. |
| Verkauf/OMS | mehrzeilige Verkäufe, Kosten, Versandkosten, Storno, Plattformbezug | echte Marktplatz-/Shop-Integration, Order-Sync, Zahlungs-/Payout-Abgleich, Rechnungs-/Gutschriftserzeugung, Kundenstamm, Multiwährung, automatisches Tracking. |
| Konsignation | eigener K-Flow und Settlement-Snapshots vorhanden | Partnerportal, Verträge, periodische Abrechnung/Payout-Läufe, partnerbezogene Reports, konsignationsspezifische Rechnungs-/Gutschriftlogik. |
| Retouren | allokiert und bestandswirksam | Retourenportal/RMA, Labels, SLA, Foto-/Prüfprotokoll, automatische Erstattungsintegration, detaillierte Retourengründe-Analyse. |
| Versand | Tarifpflege und Vorschlag | Carrier-API/Labeldruck, Tracking-Sync, Pick-Pack-Ship, Sammelmanifest, Versandregeln, Verpackungslogik. |
| Reporting | Dashboard mit Basis-KPIs, Charts, Plattform-/Monatsanalyse | frei konfigurierbare Reports, Export des neuen Ledgers, Forecasting, Cashflow/Payout-Reconciliation, Steuer-/DATEV-Export, dimensionsübergreifende Drill-downs. |
| Datenintegration | filebasierter Import, Dry Run, Quellenreferenzen | API/Webhooks, geplante Imports, Marktplatz-Connectoren, Fehler-Queue/Review-UI für ImportBatches/SourceReferences. |
| Datenlebenszyklus | Legacy-Kompatibilität bewusst vorhanden | Abschluss-/Migrationsplan für Legacytabellen, vollständiger DSGVO-Export des neuen Kerns, dokumentierte Retention/Backups. |
| Billing | Tiermodell, Checkout, Portal, Webhook | produktive Stripe-Konfiguration und Webhook-Betrieb **Unklar / muss verifiziert werden**; Entitlements über Route-Gates hinaus. |

### Priorisierte strategische Beobachtungen

1. **Höchste Datenprodukt-Priorität:** Der neue Inventory-Kern ist deutlich weiter als die Export- und Datenschutzabdeckung. Vor Ausbau weiterer Features sollte geklärt werden, ob alle neuen Kernentitäten exportierbar, auditierbar und rechtlich vollständig auskunftsfähig sind.
2. **Höchste Integrations-Priorität:** StorageX ist heute vor allem ein internes operatives System. Für den Wettbewerb mit OMS/Resale-SaaS fehlen nachgewiesen vor allem echte Plattform-, Zahlungs- und Carrier-Integrationen.
3. **Höchste Workflow-Priorität:** Versand endet bei Tarifkalkulation, Konsignation bei Bestands-/Verkaufsbezug. Label, Tracking, Auszahlungsläufe und Partnerabrechnungen wären die nächsten zusammenhängenden End-to-End-Prozesse.
4. **Höchste Transparenz-Priorität:** ImportBatch/SourceReference und historische Relationsstatus existieren im Datenmodell; eine dedizierte Review-/Monitoring-Oberfläche ist nicht nachgewiesen.

## 15. Offene Verifikationsliste

- **Unklar / muss verifiziert werden:** Produktive Stripe- und Storage-Konfiguration, Webhook-Zustellung und Fallback-Verhalten außerhalb lokaler Umgebung.
- **Unklar / muss verifiziert werden:** Ob READONLY den Tabellenexport bewusst nutzen darf.
- **Unklar / muss verifiziert werden:** Vollständigkeit der RLS-Policy-Abdeckung in einer frisch migrierten Ziel-Datenbank; das Schema/Migrationscode belegt die Absicht, kein laufendes DB-Audit.
- **Unklar / muss verifiziert werden:** Vollständiger DSGVO-Export für neue Inventory-/Import-/Relationsmodelle; der aktuelle Action-Code lädt sie nicht ausdrücklich.
- **Unklar / muss verifiziert werden:** Carrier-Modell-Nutzung und Tracking-URL-Template in einer sichtbaren UI.
- **Unklar / muss verifiziert werden:** Seed-/Demo-Datenstrategie.
- **UI sichtbar, Funktion nicht vollständig validiert:** sämtliche eingeloggten Create/Edit/Delete-, Billing-, Import-, Export-, TOTP-, Invite- und Organisationslöschflows, weil dieser Audit keine Daten verändern durfte.

## 16. Orientierung für nachfolgende Planung

Für künftige Produktplanung sollte zuerst zwischen drei Kategorien unterschieden werden:

1. **Bestehend, weiterverwenden:** der neue Inventory-/Movement-/Allocation-Kern und die vorhandenen Sicherheits-/Mandantenfundamente.
2. **Bestehend, konsolidieren:** Legacy- und neue Tabellenpfade, Export/DSGVO-Abdeckung, Import-Review und Rollen-/Export-Entscheidungen.
3. **Tatsächlich neu:** externe Commerce-/Carrier-/Payment-Integrationen, Multi-Lager/Inventur, Partnerabrechnung, operative Fulfillment- und fortgeschrittene Reporting-Workflows.

Damit verhindert die weitere Roadmap, dass bereits realisierte Kernlogik (insbesondere Bewegungsledger, Allokationen, Retourenbezug, Schuldenautomatik und Tenant-Sicherheit) erneut gebaut oder durch oberflächliche Parallelstrukturen ersetzt wird.
