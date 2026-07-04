# Stoppt die portable PostgreSQL-Instanz.

$pgDir = Join-Path $env:LOCALAPPDATA "StoargeX"
$pgCtl = Join-Path $pgDir "pgsql\bin\pg_ctl.exe"

& $pgCtl -D (Join-Path $pgDir "pgdata") stop
