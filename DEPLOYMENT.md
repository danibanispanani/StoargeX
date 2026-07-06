# Deployment: Vercel Hobby + Supabase Free

Diese Checkliste bringt StoargeX ohne lokalen Datenbankserver online:
Vercel hostet die Next.js-App, Supabase stellt PostgreSQL und Storage, GitHub
liefert den Code.

## 1. GitHub vorbereiten

1. Repository zu GitHub pushen.
2. Keine `.env` committen.
3. Vor dem Deployment lokal pruefen:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## 2. Supabase-Projekt anlegen

1. Neues Supabase-Projekt erstellen.
2. Datenbank-Passwort sicher speichern.
3. Unter `Storage` einen Bucket anlegen:
   - Name: `stock-images`
   - Public bucket: aktiviert

Der Bucket ist fuer Produkt- und Lagerbilder. Die App nutzt Supabase Storage,
sobald `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` gesetzt sind.

## 3. Datenbank migrieren

Fuer Migrationen einmalig die Supabase-Owner-Verbindung lokal in `.env` setzen.
Nutze dafuer den Supabase Connection String mit SSL, zum Beispiel:

```env
DATABASE_URL="postgresql://postgres:<DB_PASSWORD>@<HOST>:5432/postgres?sslmode=require"
```

Dann ausfuehren:

```powershell
npm run db:deploy
```

Das legt Tabellen, Indizes und Row-Level-Security-Policies an.

## 4. Runtime-Rolle fuer die App anlegen

Die App sollte nicht dauerhaft mit dem Supabase-Owner/Postgres-User laufen.
Lege nach den Migrationen im Supabase SQL Editor eine eigene Runtime-Rolle an.
`<STRONG_PASSWORD>` vorher ersetzen:

```sql
create role storagex_app
  login
  password '<STRONG_PASSWORD>'
  nosuperuser
  nocreatedb
  nocreaterole
  noinherit;

grant connect on database postgres to storagex_app;
grant usage on schema public to storagex_app;
grant select, insert, update, delete on all tables in schema public to storagex_app;
grant usage, select on all sequences in schema public to storagex_app;
grant execute on all functions in schema public to storagex_app;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to storagex_app;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to storagex_app;

alter default privileges for role postgres in schema public
  grant execute on functions to storagex_app;
```

Vercel bekommt danach eine `DATABASE_URL` mit dieser Runtime-Rolle, nicht mit
dem Supabase-Owner-User. Bei Supabase Pooler-URLs muss der Username meist im
Format `storagex_app.<project-ref>` gesetzt werden.

## 5. Vercel-Projekt erstellen

1. In Vercel `Add New Project` waehlen.
2. GitHub-Repository importieren.
3. Framework Preset: Next.js.
4. Build Command: `npm run build`.
5. Install Command leer lassen oder Default nutzen.

## 6. Vercel Environment Variables

In Vercel unter `Project Settings -> Environment Variables` setzen:

```env
DATABASE_URL="postgresql://storagex_app...?...sslmode=require"
AUTH_SECRET="<32-byte-secret>"
AUTH_URL="https://<deine-vercel-domain>"
AUTH_TRUST_HOST="true"
APP_ENCRYPTION_KEY="<64-hex-zeichen>"
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
SUPABASE_STORAGE_BUCKET="stock-images"
```

Secrets erzeugen:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Optional:

```env
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="StoargeX <noreply@deine-domain.de>"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_PRO_MONTHLY=""
STRIPE_PRICE_PRO_YEARLY=""
STRIPE_PRICE_BUSINESS_MONTHLY=""
STRIPE_PRICE_BUSINESS_YEARLY=""
```

Ohne SMTP werden Einladungslinks nur in die Server-Logs geschrieben. Fuer echte
Team-Einladungen in Produktion sollte SMTP konfiguriert werden.

## 7. Erstes Deployment

1. In Vercel `Deploy` starten.
2. Nach erfolgreichem Build die Vercel-Domain oeffnen.
3. Unter `/registrieren` den ersten Account und die erste Organisation anlegen.
4. 2FA fuer OWNER einrichten.

## 8. Spaetere Schema-Aenderungen

Wenn Prisma-Migrationen neu dazukommen:

1. Lokal temporaer `DATABASE_URL` auf die Supabase-Owner-Verbindung setzen.
2. Ausfuehren:

```powershell
npm run db:deploy
```

3. Danach Vercel neu deployen.

Die Vercel-Runtime bleibt weiter auf der eingeschraenkten `storagex_app`-Rolle.

## 9. Wichtige Hinweise

- `npm run db:up` ist nur fuer lokale PostgreSQL-Instanzen relevant und wird
  bei Supabase nicht mehr benutzt.
- `scripts/init-db.sql` ist nur fuer lokale Setups/Docker gedacht.
- Supabase Storage muss public sein, weil gespeicherte Bild-URLs direkt im UI
  angezeigt werden.
- `SUPABASE_SERVICE_ROLE_KEY` niemals mit `NEXT_PUBLIC_` prefixen.
- `AUTH_URL` muss nach eigener Domain-Aenderung angepasst werden.
