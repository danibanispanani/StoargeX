# StorageX Beta – bekannte Einschränkungen

Stand: 17. Juli 2026

> **Historische Messbasis:** Dieses Dokument ist kein aktuelles Release-Gate und keine Beta-Freigabe. Insbesondere KL-01 wird durch den laufenden Sales-Read-Performance-Pilot neu gemessen. Die weiterhin relevanten Sicherheits- und Betriebsrisiken bleiben bis zu einer erneuten Verifikation offen.

Es bestehen keine bekannten P0- oder P1-Blocker. Die folgenden Punkte müssen im Beta-Betrieb sichtbar bleiben.

## KL-01 – Verkaufsseite bleibt bei großen Ergebnismengen CPU-lastig

- Schweregrad: P2 / Mittel
- Reproduktion: `/verkauf` mit mindestens 100 Verkaufsbelegen öffnen und Lighthouse gegen den Production-Build ausführen.
- Beobachtung: Nach Pagination und Lazy-Mount 71/100 Performance, TBT etwa 1,4 s bei 50 Tabellenzeilen.
- Betroffene Dateien/Route: `/verkauf`, `app/(app)/verkauf/page.tsx`, `components/sales/lazy-sale-dialog.tsx`
- Bereits umgesetzt: serverseitige Pagination, serverseitige Ansichtsfilter, Lazy-Mount der Bearbeiten-Formulare.
- Empfohlener Fix: einen einzigen geteilten Zeileneditor verwenden und bei weiterem Wachstum Tabellenzeilen virtualisieren. Danach auf realer Produktionslatenz erneut messen.

## KL-02 – Rate Limiting ist instanzlokal

- Schweregrad: P2 / Mittel bei horizontaler Skalierung
- Reproduktion: zwei App-Instanzen starten und dieselbe Login-/Registrierungsrate abwechselnd gegen beide Instanzen senden.
- Beobachtung: jede Instanz hält ihren eigenen In-Memory-Zähler.
- Betroffene Datei: `middleware.ts`
- Empfohlener Fix: vor Multi-Instance-Betrieb einen verteilten, tenant- und IP-sicheren Store wie Redis/Upstash verwenden. Datenschutzgerechte Schlüssel und TTL dokumentieren.

## KL-03 – Uploadprüfung validiert Größe und MIME, nicht den Dateiinhalt

- Schweregrad: P2 / Mittel
- Reproduktion: eine Datei mit erlaubter Endung beziehungsweise MIME, aber abweichender Signatur an einen Bild-Upload übergeben.
- Beobachtung: es gibt keine Magic-Byte-Prüfung und keinen Malware-Scan.
- Betroffene Dateien/Routen: `lib/uploads.ts`, Produkt- und Lager-Uploads
- Empfohlener Fix: Dateisignatur serverseitig prüfen, Bilder dekodieren/re-encodieren und bei öffentlichen oder fremden Uploads einen Malware-Scan ergänzen. Lokalen Fallback nicht auf ephemeren Multi-Instance-Deployments verwenden.

## KL-04 – Externe Produktionsdienste wurden nicht live ausgelöst

- Schweregrad: P2 / Deployment-Bedingung
- Reproduktion: produktive Stripe-, E-Mail- oder Backup-Credentials entfernen beziehungsweise falsch konfigurieren.
- Beobachtung: Unit-/Integrationstests decken Codepfade ab; reale Zahlung, reale Einladungszustellung und ein Restore aus dem verwalteten Produktionsbackup wurden in diesem Gate nicht ausgelöst.
- Betroffene Bereiche: Stripe Checkout/Webhook, Team-Einladungen, `docs/backup-and-restore.md`
- Empfohlener Fix: vor öffentlicher Beta je Umgebung einen signierten Stripe-Testwebhook, eine echte Einladung an eine kontrollierte Adresse und einen dokumentierten Restore in eine isolierte Datenbank ausführen.

## KL-05 – OWNER-only Browserpfade wurden mit dem MEMBER-QA-Konto nicht mutiert

- Schweregrad: P3 / Niedrig
- Reproduktion: das Release-QA-Konto besitzt absichtlich nur MEMBER.
- Beobachtung: die 403-Abweisung des Vollauszugs wurde im Browser bestätigt; erfolgreicher OWNER-Vollauszug, DSGVO-Export und Teamrollenmutation sind automatisiert, nicht mit diesem Browserkonto geprüft.
- Betroffene Routen: `/daten/export`, `/einstellungen`, `/team`
- Empfohlener Fix: für Staging ein getrenntes kurzlebiges OWNER-QA-Konto mit erzwungener 2FA verwenden und nach dem Test deaktivieren.

## KL-06 – Tooling-Grenzen der aktuellen Next.js-Version

- Schweregrad: P3 / Niedrig
- Reproduktion: Next DevTools MCP gegen Next.js 15.5.20 starten.
- Beobachtung: die MCP-Laufzeitdiagnostik ist erst ab Next.js 16 verfügbar; das konfigurierte Chrome-DevTools-MCP stellte keine Tools bereit.
- Ersatzprüfung: Agent-Browser, direkter CDP-Trace, Lighthouse, Console-/Network-/Hydration-Audit.
- Empfohlener Fix: Next.js separat und geplant auf Version 16+ aktualisieren; kein Framework-Upgrade im Release-Gate erzwingen.
