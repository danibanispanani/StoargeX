# StorageX Security Release Checklist

Stand: 17. Juli 2026

| Bereich | Status | Evidenz / Bedingung |
| --- | --- | --- |
| Tenant-Isolation | Bestanden | `requireOrg` liefert ausschließlich `tenantDb`; Cross-Tenant-Service-Tests und Integritätschecks grün |
| RLS | Bestanden | FORCE RLS in Migrationen; 23 Migrationen aktuell |
| Rollen | Bestanden | READONLY/MEMBER/ADMIN/OWNER serverseitig geprüft; MEMBER wird bei Zugangsdaten und Vollauszug abgewiesen |
| Feature Entitlements | Bestanden | Konsignation in Navigation, Route und Mutationen geprüft; Daten bleiben ohne Entitlement erhalten |
| Exportberechtigungen | Bestanden | Fachauszüge tenant-gescoped; Vollauszug/DSGVO OWNER-only; Browser-403 für MEMBER |
| IDOR | Bestanden | Fachobjekte werden über tenant-gescoppte Clients geladen; Cross-Tenant-Linkchecks ergeben 0 |
| Servervalidierung | Bestanden | Actions validieren Rollen, Tenant, Statusübergänge und Fachinvarianten |
| Secrets | Bestanden | Credential-Tresor bleibt serverseitig; Datenexporte schließen Secrets aus; keine QA-Credentials versioniert |
| AuditLog | Bestanden | zentrale Mutations- und Billingpfade schreiben Audit-Ereignisse |
| Stripe-Webhooks | Bestanden | Signatur- und Idempotenztests grün; Live-Test vor produktiver Aktivierung erforderlich |
| Rate Limiting | Bedingt | Login/Registrierung geschützt, Store jedoch instanzlokal; vor Horizontal-Skalierung verteilen |
| Uploads | Bedingt | Größe, MIME, randomisierte Namen und Tenant-Pfad; Signaturprüfung/Malware-Scan noch offen |
| Backups | Bedingt | Strategie und Jobkonfiguration dokumentiert/getestet; echter Restore ist Deployment-Check |
| Console/Network | Bestanden | keine Runtime-, Hydration-, 4xx-/5xx-Fehler auf erlaubten Kernflüssen |
| Abhängigkeiten/Build | Bestanden | Production-Build, Typecheck, Lint und alle Tests grün |

## Rollenmatrix

| Fähigkeit | READONLY | MEMBER | ADMIN | OWNER |
| --- | ---: | ---: | ---: | ---: |
| operative Daten lesen | Ja | Ja | Ja | Ja |
| operative Vorgänge anlegen/ändern | Nein | Ja | Ja | Ja |
| Gebührenkataloge und Einstellungen verwalten | Nein | Nein | Ja | Ja |
| Zugangsdaten verwalten | Nein | Nein | Ja | Ja |
| Mitglieder verwalten | Nein | Nein | Ja, ohne OWNER-Hoheit | Ja |
| Vollauszug/DSGVO/Löschung | Nein | Nein | Nein | Ja |
| Billing/Add-on verwalten | Nein | Nein | Nein | Ja |

OWNER und ADMIN unterliegen im regulären Produkt der 2FA-Pflicht. Das Release-QA-Konto ist absichtlich MEMBER und besitzt keine 2FA-Ausnahme für privilegierte Rollen.

## Releasebedingungen

Vor einem öffentlichen oder horizontal skalierten Deployment:

1. verteiltes Rate Limiting aktivieren;
2. Upload-Signaturprüfung und bei Fremduploads Malware-Scanning ergänzen;
3. Stripe-Testwebhook mit realer Signatur in der Zielumgebung ausführen;
4. Einladungszustellung an eine kontrollierte Adresse prüfen;
5. Restore aus einem realen Backup in eine isolierte Datenbank durchführen und protokollieren.

Für die kontrollierte Beta bestehen keine offenen kritischen oder hohen Security-Befunde.
