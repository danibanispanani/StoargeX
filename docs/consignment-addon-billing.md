# Konsignations-Add-on, Trials und Billing-Entitlements

## Ziel und Kompatibilität

Konsignation bleibt Bestandteil des StorageX-Domain-Kerns. Das Billing steuert
ausschließlich Sichtbarkeit und erlaubte Nutzung; es verändert oder löscht
keine Konsignationsbestände, Lots, Movements, Verkäufe, Retouren oder
Partnerbezüge.

Das bestehende Basistarifmodell bleibt erhalten. Organisationen im
`BUSINESS`-Tarif behalten ihren bisherigen Konsignationszugriff über den
kompatiblen `LEGACY_TIER`-Pfad. Organisationen in `FREE` oder `PRO` können
Konsignation separat als Add-on aktivieren.

## Entitlement-Auflösung

Die zentrale Auswertung liegt in
`lib/services/feature-entitlement-service.ts`. Request- und
Tenant-Auflösung erfolgen ausschließlich über `lib/feature-access.ts`.
Konsignationsmutationen verwenden weiterhin `requireOrgFeature` und werden
nicht nur visuell gesperrt.

| Status | Zugriff | Ende |
| --- | --- | --- |
| `ACTIVE` | vollständig gemäß Organisationsrolle | optional `endsAt` |
| `GRACE_PERIOD` | vollständig gemäß Organisationsrolle | zwingend `endsAt` |
| `CANCELLED` | vollständig bis zum Laufzeitende | zwingend zukünftiges `endsAt` |
| `SCHEDULED` | noch nicht aktiv | über `startsAt` gesteuert |
| `INACTIVE` | gesperrt | kein Zugriff |
| `EXPIRED` | gesperrt | kein Zugriff |

`CANCELLED` bezeichnet eine Kündigung zum Laufzeitende, nicht eine sofortige
Sperre. `GRACE_PERIOD` wird nur bis zu einem festen Ende akzeptiert. Wiederholte
Stripe-Events verlängern dieses Ende nicht.

Quellen:

- `SUBSCRIPTION`: tarif- oder vertragsbezogene Freischaltung;
- `ADD_ON`: separates Add-on;
- `TRIAL`: zeitlich begrenzte Testphase;
- `MANUAL`: interne manuelle Freischaltung.

Bei mehreren gültigen Grants gewinnt deterministisch der länger gültige und
anschließend der stärkere Grant. Der `BUSINESS`-Fallback greift nur, wenn kein
expliziter Grant gewählt wurde.

## Rollen und serverseitige Grenzen

- Lesen der Billing-Informationen folgt der normalen Organisationsrolle.
- Add-on-Checkout, Trial, manuelle Freischaltung und Stripe-Portal verlangen
  serverseitig `OWNER`.
- Fachmutationen in Konsignation verlangen weiterhin mindestens die jeweils
  bestehende Rolle und zusätzlich ein aktives `CONSIGNMENT`-Entitlement.
- Ohne Add-on wird `/konsignation` vor den Fachdatenabfragen beendet und zeigt
  einen Add-on-Einstieg.
- Der vollständige, OWNER-geschützte Organisations-/DSGVO-Export enthält
  Entitlements und tenant-verknüpfte Webhook-Protokolle. Secrets werden nicht
  exportiert.

## Trial und manuelle Freischaltung

Die Self-Service-Testphase:

- ist standardmäßig 14 Tage lang;
- besitzt den vollständigen Funktionsumfang;
- kann pro Organisation nur einmal gestartet werden;
- benötigt kein Stripe-Setup;
- wird über `CONSIGNMENT_ADDON_TRIAL_DAYS` zwischen 1 und 60 Tagen
  konfiguriert.

Interne Tests können optional über
`CONSIGNMENT_ADDON_MANUAL_CODE` freigeschaltet werden. Ist die Variable leer,
ist dieser Pfad deaktiviert. Der Code wird weder im Entitlement noch im
`AuditLog` gespeichert.

## Stripe-Konfiguration

Benötigte Variablen:

```dotenv
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_CONSIGNMENT_MONTHLY=""
STRIPE_PRICE_CONSIGNMENT_YEARLY=""
CONSIGNMENT_ADDON_TRIAL_DAYS="14"
CONSIGNMENT_ADDON_GRACE_DAYS="7"
CONSIGNMENT_ADDON_MANUAL_CODE=""
```

Das Add-on verwendet einen separaten Subscription-Checkout mit Metadaten:

```text
billingKind=ADD_ON
featureKey=CONSIGNMENT
organizationId=<interne Organisations-ID>
```

Basistarif-Checkouts tragen `billingKind=BASE` und `tier`. Webhook-Sync
klassifiziert alle Subscription-Items anhand konfigurierter Price-IDs. Ein
reines Add-on-Event darf deshalb `organization.subscriptionTier` nicht
verändern; ein reines Basistarif-Event darf kein Add-on-Entitlement erzeugen.

Die Pricing-Oberfläche nennt keinen lokal hardcodierten Add-on-Preis. Der
verbindliche Betrag wird im Stripe-Checkout der konfigurierten Price-ID
angezeigt. Damit kann die öffentliche Aussage nicht von der produktiven
Stripe-Konfiguration abweichen.

## Webhook-Verarbeitung und Idempotenz

Unterstützte Events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Verarbeitungsfolge:

1. Raw Request Body und `Stripe-Signature` werden mit
   `stripe.webhooks.constructEvent` geprüft.
2. Organisation und aktuelles Subscription-Snapshot werden aufgelöst.
3. Eine PostgreSQL-Advisory-Lock serialisiert die Stripe-Event-ID.
4. `BillingWebhookEvent.stripeEventId` erzwingt globale Eindeutigkeit.
5. Bereits `PROCESSED` oder noch `PROCESSING` markierte Events werden nicht
   erneut fachlich angewendet.
6. Billing-Projektion, Entitlement-/Tarifänderung, `AuditLog` und
   `PROCESSED`-Markierung erfolgen in einer Transaktion mit System-RLS-Bypass.
7. Bei einem Fehler rollt die Fachtransaktion zurück. Eine getrennte,
   minimale Fehlertransaktion hält `FAILED`, Versuchszahl und eine gekürzte
   Fehlermeldung fest. Stripe erhält HTTP 500 und kann wiederholen.

`payloadSummary` enthält nur technische Referenzen wie Eventtyp,
Subscription-ID, Customer-ID, Status und Price-IDs. Raw Payload,
Webhook-Signatur, API-Key oder andere Secrets werden nicht gespeichert.

## Stripe-Statusabbildung

| Stripe-Status | Entitlement |
| --- | --- |
| `trialing` | `ACTIVE` / `TRIAL` bis `trial_end` |
| `active` | `ACTIVE` / `ADD_ON` bis zum Item-Zeitraumende |
| `active` + `cancel_at_period_end` | `CANCELLED` bis zum Item-Zeitraumende |
| `past_due` | feste `GRACE_PERIOD` |
| `canceled`, `unpaid`, `incomplete_expired`, `paused` | `EXPIRED` |
| `incomplete` | `INACTIVE` |

Bei Stripe SDK 22 liegt das aktuelle Periodenende am Subscription-Item. Die
Synchronisierung verwendet deshalb das zum Add-on-Preis gehörende Item und
nicht blind das erste Subscription-Item.

## Datenhaltung, Deaktivierung und Export

- Die Migration ist additiv: Enum-Erweiterung, optionale Stripe-Felder und
  neue Webhook-Protokolltabelle.
- Keine Legacy-Spalte wird entfernt und kein bestehender Datensatz muss
  nachbefüllt werden.
- Ein Ablauf aktualisiert ausschließlich das Entitlement.
- Konsignationsdaten und Relationen bleiben unverändert.
- Ohne aktives Add-on bleibt der definierte vollständige Organisationsexport
  für `OWNER` verfügbar.
- Billing-Webhooks besitzen `organization_id`, erzwungenes PostgreSQL-RLS und
  eine separate System-Bypass-Policy für den signaturgeprüften Webhook.

## UI-Verhalten

- Aktives Add-on: normale Navigation und volle Nutzung gemäß Rolle.
- Trial: Navigation und globales Statusband zeigen die Restlaufzeit.
- Grace Period: Navigation, Statusband und Billing-Karte zeigen das feste Ende.
- Kündigung zum Laufzeitende: Zugriff bleibt intakt und das Enddatum ist
  sichtbar.
- Ohne Add-on: Navigation kennzeichnet das Modul als Add-on; die Route zeigt
  einen klaren Pricing-/Trial-Einstieg.
- Einstellungen zeigen Basistarif und Add-on getrennt.
- Business wird weiterhin korrekt als Tarif mit enthaltener Konsignation
  beschrieben; Free und Pro zeigen das separat buchbare Add-on.

## Testabdeckung

- Lifecycle: aktiv, Trial, Grace Period, Kündigung zum Laufzeitende, Ablauf;
- einmalige Trial-Berechtigung;
- Basistarif-/Add-on-Klassifizierung;
- Sync-Trennung zwischen Basistarif und Add-on;
- Datenerhalt beim Ablauf;
- Route Gate und alle bestehenden Konsignations-Server-Actions;
- OWNER-Grenze für Checkout, Trial und manuelle Freischaltung;
- fehlende und ungültige Webhook-Signatur;
- Webhook-Duplikate, fehlgeschlagener Versuch und erfolgreicher Retry;
- additive Migration, Eindeutigkeit und Tenant-RLS.
