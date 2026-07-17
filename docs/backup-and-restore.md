# StorageX Backup and Restore

Stand: 17. Juli 2026
Deploymentziel: Vercel + Supabase PostgreSQL/Storage

## Schutzschichten

1. **Supabase-Providerbackup prüfen:** Laut aktueller Supabase-Dokumentation erhalten Pro-, Team- und Enterprise-Projekte tägliche Datenbankbackups mit tarifabhängiger Retention; PITR ist ein separates Add-on. Free-Projekte sollen regelmäßig logische Offsite-Exporte erstellen. Der tatsächlich gebuchte Produktionstarif muss im Supabase Dashboard unter `Database → Backups` geprüft werden. Die Repository-Dokumentation nennt bislang Supabase Free, deshalb wird kein Providerbackup still vorausgesetzt.
2. **Tägliches logisches Offsite-Backup:** `.github/workflows/database-backup.yml` führt täglich und manuell `pg_dump --format=custom --no-owner --no-acl` aus.
3. **Verschlüsselung:** Das Dump wird vor Upload mit AES-256-CBC, Salt und PBKDF2 (200.000 Iterationen) verschlüsselt. Die Passphrase liegt ausschließlich als GitHub Environment Secret vor.
4. **Restore-Prüfung:** Der Job entschlüsselt eine temporäre Kopie und führt `pg_restore --list` aus. Nur ein erfolgreich lesbares Archiv wird 30 Tage als GitHub Actions Artifact aufbewahrt.
5. **Storage-Objekte:** Supabase-Datenbankbackups enthalten keine Storage-Objekte. Wenn S3-Zugangsdaten konfiguriert sind, synchronisiert derselbe Job den Storage-Bucket über den offiziellen S3-kompatiblen Endpunkt, verschlüsselt das TAR und hält es ebenfalls 30 Tage. Supabase Storage bietet keine Objektversionierung; gelöschte Objekte sind ohne diesen Export nicht wiederherstellbar.

Herstellerquellen:

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase S3 Compatibility](https://supabase.com/docs/guides/storage/s3/compatibility)
- [Supabase S3 Authentication](https://supabase.com/docs/guides/storage/s3/authentication)
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [GitHub Actions schedule syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule)

## Einmalige Produktionskonfiguration

GitHub Environment `production-backup` anlegen, Zugriff auf wenige Administratoren begrenzen und folgende Secrets setzen:

| Secret | Zweck |
|---|---|
| `BACKUP_DATABASE_URL` | direkte, SSL-geschützte PostgreSQL-Verbindung mit ausreichendem Lesezugriff; keine Transaction-Pooler-URL |
| `BACKUP_ENCRYPTION_PASSPHRASE` | zufällige Passphrase, mindestens 32 Zeichen; getrennt vom Datenbankpasswort sichern |
| `BACKUP_ALERT_WEBHOOK_URL` | optionaler interner Alarm-WebHook |
| `SUPABASE_S3_ACCESS_KEY_ID` | optionaler serverseitiger Supabase-S3-Key |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | optionales S3-Secret |
| `SUPABASE_S3_ENDPOINT` | direkter Storage-Endpunkt, z. B. `https://<ref>.storage.supabase.co/storage/v1/s3` |
| `SUPABASE_S3_REGION` | Region aus der Supabase S3-Konfiguration |
| `SUPABASE_STORAGE_BUCKET` | zu sichernder Bucket, derzeit typischerweise `stock-images` |

S3-Keys umgehen Storage-RLS und gehören ausschließlich in das geschützte Environment. Sie dürfen weder in Vercel-Clientvariablen noch in Repository-Dateien stehen.

## Status, Retention und Alarmierung

- Zeitplan: täglich 02:17 UTC; zusätzlich `workflow_dispatch`.
- Parallelität: maximal ein Backupjob, laufende Jobs werden nicht abgebrochen.
- Timeout: 30 Minuten.
- Statusprotokoll: GitHub Workflow Run, Job Summary, Dateigröße und SHA-256.
- Retention: 30 Tage für verschlüsselte DB- und optional Storage-Artefakte.
- Fehler: Workflow schlägt hart fehl, erzeugt eine sichtbare GitHub-Error-Annotation und sendet optional an den Alarm-WebHook.

Repository-Owner müssen Benachrichtigungen für fehlgeschlagene Actions aktivieren und mindestens monatlich prüfen, dass täglich ein verifiziertes Artefakt existiert. Ein grüner Vercel-Deploy ersetzt diese Kontrolle nicht.

## Restore-Test (vierteljährlich und nach Schemaänderungen)

Nie zuerst in Produktion restaurieren.

1. Letztes erfolgreiches DB-Artefakt herunterladen und SHA-256 mit der Workflow Summary vergleichen.
2. Passphrase aus dem getrennten Secret-Store bereitstellen.
3. Archiv in einem isolierten Arbeitsverzeichnis entschlüsseln:

```bash
export STORAGEX_BACKUP_PASSPHRASE='...'
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in storagex-YYYYMMDDTHHMMSSZ.dump.enc \
  -out storagex.restore.dump \
  -pass env:STORAGEX_BACKUP_PASSPHRASE
pg_restore --list storagex.restore.dump
```

4. Neue leere PostgreSQL-Testdatenbank aus `template0` anlegen.
5. Restore mit Fehlerabbruch:

```bash
createdb -T template0 storagex_restore_test
pg_restore --exit-on-error --no-owner --no-acl \
  --dbname storagex_restore_test storagex.restore.dump
```

6. `DATABASE_URL` ausschließlich für diesen Prozess auf die Testdatenbank setzen; Prisma-Migrationsstatus, `npm run integrity:check`, Login und repräsentative Lesewege prüfen.
7. Zeilenzahlen/Schlüsselsummen mit dem Backup-Run vergleichen. Keine E-Mails, Webhooks oder produktiven Integrationen aus der Restore-Umgebung zulassen.
8. Storage-Artefakt entschlüsseln, TAR-Inhalt listen und stichprobenartig Hash/Dateigröße prüfen. Erst nach Freigabe in einen neuen isolierten Bucket kopieren.
9. Testdatenbank, entschlüsselte Dumps und extrahierte Dateien sicher löschen; Ergebnis, Datum, RPO/RTO und Abweichungen im internen Betriebsprotokoll festhalten.

## Provider-Restore

Ein Supabase Daily-/PITR-Restore macht das Projekt während des Vorgangs zeitweise unzugänglich. Vorher Wartungsfenster, Zielzeitpunkt, Integrationsstopp und erwarteten Datenverlust (RPO) festlegen. Custom-Rollenpasswörter müssen nach einem Providerrestore gegebenenfalls neu gesetzt werden. Storage-Objekte werden separat aus dem verschlüsselten Storage-Artefakt wiederhergestellt.

## Grenzen

- GitHub-Schedules sind kein Sekunden-genauer Scheduler; der Workflow-Run ist die maßgebliche Kontrolle.
- GitHub Artifact Retention ist eine Offsite-Kopie, aber kein unveränderbares WORM-Archiv. Für höhere Compliance-Anforderungen ist zusätzlich ein separates Object-Storage-Ziel mit Object Lock zu konfigurieren.
- Kein Backupfile, entschlüsseltes Archiv oder Secret darf in Git, `.next`, `public/` oder dauerhaften Runner-Workspace geschrieben werden.
