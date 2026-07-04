# StoargeX

Multi-Tenant SaaS für Handels-GbRs: Ein- und Verkauf über eBay, Vinted,
Kleinanzeigen & Co. – mit harter Mandantentrennung per Postgres Row Level
Security.

## Stack

- **Next.js 15** (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui
- **Prisma 6** + PostgreSQL, Multi-Tenancy über `organization_id` + **RLS**
- **Auth.js v5** (Credentials + optional Google), JWT-Session (httpOnly/secure),
  Passwörter mit **argon2id**, **TOTP-2FA** (Pflicht für OWNER/ADMIN)

## Lokales Setup

### 1. Datenbank starten

**Portable PostgreSQL (ohne Docker, eingerichtet):** Auf diesem Rechner läuft
eine portable PostgreSQL-17-Instanz unter `%LOCALAPPDATA%\StoargeX`
(Binaries in `pgsql\`, Daten in `pgdata\` – bewusst außerhalb von OneDrive).
Starten/Stoppen:

```bash
npm run db:up     # startet Postgres auf localhost:5432 (nach jedem Neustart nötig)
npm run db:down   # stoppt Postgres
```

Einmalige Neu-Einrichtung auf einem anderen Rechner (ZIP von
https://www.enterprisedb.com/download-postgresql-binaries nach
`%LOCALAPPDATA%\StoargeX\pgsql` entpacken, dann):

```powershell
$dir = "$env:LOCALAPPDATA\StoargeX"
Set-Content "$dir\pgpass.txt" "postgres" -Encoding ascii -NoNewline
& "$dir\pgsql\bin\initdb.exe" -D "$dir\pgdata" -U postgres --pwfile="$dir\pgpass.txt" -E UTF8 -A scram-sha-256 --locale=C
npm run db:up
$env:PGPASSWORD = "postgres"
& "$dir\pgsql\bin\psql.exe" -h localhost -U postgres -d postgres -f scripts\init-db.sql
```

**Alternativ mit Docker** (`npm run db:up:docker`): legt Rolle + Datenbank
automatisch über `scripts/init-db.sql` an.

In beiden Fällen entsteht die Rolle `storagex` (Nicht-Superuser!) und die
Datenbank `storagex` – passend zur `DATABASE_URL` in `.env`.

> ⚠️ **Wichtig:** Die App darf **nicht** als Superuser verbinden.
> Postgres-Superuser umgehen Row Level Security immer – die Mandantentrennung
> wäre dann wirkungslos. Deshalb `NOSUPERUSER`; `FORCE ROW LEVEL SECURITY`
> in der Migration sorgt dafür, dass auch der Tabellen-Owner den Policies
> unterliegt. `CREATEDB` braucht die Rolle nur für Prismas Shadow-Database
> bei `prisma migrate dev`.

### 2. Environment

`.env` existiert bereits mit lokalen Defaults (bzw. `.env.example` kopieren).
Secrets neu erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"     # APP_ENCRYPTION_KEY
```

### 3. Migration ausführen

Die initiale Migration liegt in `prisma/migrations/20260704000000_init/`
(Tabellen + Indizes + RLS-Policies). Anwenden mit:

```bash
npx prisma migrate dev
```

(oder `npm run db:migrate`; in CI/Produktion: `npx prisma migrate deploy`)

### 4. App starten

```bash
npm run dev
```

→ http://localhost:3000 · Registrierung unter `/registrieren` gründet die
erste Organisation (du wirst automatisch OWNER; danach fordert die App das
verpflichtende 2FA-Setup an).

E-Mail-Versand: ohne `SMTP_HOST` werden Einladungslinks in die Server-Konsole
geloggt (praktisch für lokale Tests). Für echte Mails z.B.
[Mailpit](https://mailpit.axllent.org/) lokal laufen lassen.

## Mandantentrennung (RLS)

- Jede mandantenspezifische Tabelle hat `organization_id` (Pflicht + Index).
- Die Policies filtern hart auf `current_setting('app.current_org_id')`.
- `lib/tenant-db.ts` → `tenantDb(orgId)` setzt den Kontext pro Transaktion.
  **Alle Geschäftsdaten-Queries laufen ausschließlich über diesen Client.**
- `lib/prisma.ts` → `bypassDb()` (Policy `app.bypass_rls = 'on'`) nur für
  Systemflows vor dem Org-Kontext: Login, Registrierung, Einladung annehmen.
- `lib/org.ts` → `requireOrg(minRole)` prüft pro Request Session +
  Mitgliedschaft frisch aus der DB und liefert den Tenant-Client.

## Struktur

```
app/
  (auth)/login, (auth)/registrieren   Öffentliche Auth-Seiten
  einladung/[token]                   Einladungsflow
  (app)/dashboard, /team, /einstellungen(/sicherheit)   Geschützter Bereich
  api/auth/[...nextauth]              Auth.js-Handler
auth.ts / auth.config.ts              Auth.js (voll / edge-tauglich)
middleware.ts                         Login-, Org- und 2FA-Erzwingung
lib/                                  prisma, tenant-db, org, crypto, totp, mail, audit, actions/
components/                           ui/ (shadcn), auth/, team/, settings/
prisma/schema.prisma                  Datenmodell (13 Domänen-Modelle + Auth)
prisma/migrations/..._init/           Initiale Migration inkl. RLS-Policies
```
