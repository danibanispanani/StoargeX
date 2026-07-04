# Startet die portable PostgreSQL-Instanz (ohne Docker).
# Binaries + Datenverzeichnis liegen unter %LOCALAPPDATA%\StoargeX
# (bewusst außerhalb von OneDrive). Einmalige Einrichtung: siehe README.

$pgDir = Join-Path $env:LOCALAPPDATA "StoargeX"
$pgCtl = Join-Path $pgDir "pgsql\bin\pg_ctl.exe"
$dataDir = Join-Path $pgDir "pgdata"

if (-not (Test-Path $pgCtl)) {
    Write-Error "PostgreSQL nicht gefunden unter $pgDir. Setup: siehe README (Abschnitt 'Ohne Docker')."
    exit 1
}

& $pgCtl -D $dataDir status | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "PostgreSQL laeuft bereits (localhost:5432)."
    exit 0
}

& $pgCtl -D $dataDir -l (Join-Path $pgDir "pg.log") -o "-p 5432" start
