# StorageX Team Task Workflow

Stand: 15. Juli 2026  
Phase: Prompt 7

## Ziel und Einordnung

Der Bereich `/aufgaben` ist ein operativer Team-Arbeitsraum. Er erweitert das vorhandene Kanban und bewahrt bestehende `Task`-Datensätze, `archived`, `assigneeId` und die bisherigen Statuswerte. Die in Prompt 1 angelegten Modelle `TaskAssignment`, `TaskChecklistItem` und `TaskActivity` bleiben die gemeinsame Grundlage; es gibt kein paralleles Aufgaben- oder Benachrichtigungssystem.

## Additive Datenbasis

- `Task.scope` unterscheidet `PERSONAL` und `TEAM`; `null` bleibt für Legacy-Aufgaben lesbar.
- `TaskAssignment` erlaubt mehrere Bearbeiter und höchstens eine Rolle `PRIMARY`. Der Service erzwingt bei persönlichen Aufgaben genau einen Primary und bei zugewiesenen Teamaufgaben ebenfalls einen Primary.
- `TaskChecklistItem` speichert geordnete Checklistenpunkte und den Abschlussakteur.
- `TaskActivity` ist der unveränderliche Aktivitäts- und Kommentarstrom. Adressierte Ereignisse enthalten Empfänger-IDs in `details`.
- `Task.snoozedUntil` bildet eine Wiedervorlage ab. Aufgaben mit zukünftiger Wiedervorlage werden aus den aktiven Ansichten ausgeblendet, bleiben aber erhalten.
- `TaskDomainLink` verknüpft Aufgaben relational mit Einkauf, Lagerposition, Verkauf, Kundenretoure, Lieferantenretoure oder Schuld. Ein Datenbank-Check erzwingt genau ein Ziel passend zum Typ.
- `Task.progressPercent` bleibt aus Kompatibilitätsgründen bestehen. Die UI zeigt jedoch ausschließlich den aus der Checkliste oder dem Status abgeleiteten Fortschritt.

Die Migration `20260715160000_team_task_management` ist rein additiv. `task_domain_links` besitzt `organization_id`, erzwungenes RLS, Tenant- und Bypass-Policy sowie Fremdschlüssel auf die vorhandenen Fachobjekte.

## Berechtigungen

Alle Entscheidungen werden in `lib/services/task-permission-policy.ts` getroffen und in den Server Actions erneut geprüft. UI-Sichtbarkeit ist nur eine zusätzliche Bedienhilfe.

| Aktion | READONLY | MEMBER | ADMIN | OWNER |
| --- | --- | --- | --- | --- |
| Aufgaben lesen | ja, im erlaubten Sichtbarkeitsbereich | ja | ja | ja |
| Aufgabe erstellen | nein | ja | ja | ja |
| Andere Teammitglieder zuweisen | nein | ja, nur aktive Mitglieder derselben Organisation | ja | ja |
| Persönliche Aufgabe ändern | nein | Ersteller oder Bearbeiter | alle | alle |
| Teamaufgabe ändern | nein | Ersteller oder Bearbeiter | alle | alle |
| Teamaufgabe kommentieren | nein | ja | ja | ja |
| Archivieren/Wiederherstellen | nein | Ersteller oder Primary; nur erledigt/abgebrochen archivierbar | alle | alle |

Nicht-Manager sehen Teamaufgaben sowie persönliche Aufgaben, die sie erstellt haben oder denen sie zugewiesen sind. `ADMIN` und `OWNER` sehen alle Aufgaben der Organisation. Die RLS-Schicht bleibt die letzte Tenant-Grenze.

## Ansichten und Darstellung

Die Navigation innerhalb von `/aufgaben` bietet:

1. Meine Aufgaben
2. Team
3. Von mir zugewiesen
4. Nach Mitglied
5. Nach Bereich
6. Fällig
7. Erledigt
8. Archiv

Jede Ansicht kann als Kanban nach Status oder als kompakte Liste dargestellt werden. Suche, Status, Priorität, Mitglied, Bereich, Sortierspalte und Sortierrichtung liegen in der URL und sind dadurch teilbar sowie nach Navigation wiederherstellbar. Die Standardansicht ist `Meine Aufgaben`.

Der Detaildialog zeigt und bearbeitet im erlaubten Rollenrahmen Titel, Beschreibung, Bereich, Priorität und Frist. Zusätzlich enthält er Bearbeiter mit Primary-Markierung, Status, Fachobjektlinks, Checkliste, abgeleiteten Fortschritt, Kommentare, Aktivitätsverlauf, Wiedervorlage und die fachlich erlaubte Archivaktion.

## Fortschritt

- Gibt es Checklistenpunkte, gilt `abgeschlossen / gesamt`; der Prozentwert wird gerundet daraus berechnet.
- Ohne Checkliste zeigt die UI keinen frei erfundenen Prozentwert. `DONE` entspricht abgeschlossen; alle anderen Zustände bleiben statusgeführt.
- Das Abhaken eines Punkts aktualisiert den gespeicherten Kompatibilitätswert, die Anzeige wird bei jedem Lesen erneut aus den Punkten abgeleitet.

## In-App-Benachrichtigungen

Es wird die bestehende `TaskActivity` weiterverwendet:

- neue Zuweisung: `ASSIGNED`
- Kommentar: `COMMENTED`
- Statuswechsel: `STATUS_CHANGED`
- weitere Historie: Checkliste, Wiedervorlage, Archivierung und Wiederherstellung

Zuweisungs-, Kommentar- und Statusereignisse enthalten die betroffenen Bearbeiter als `recipientIds`. `/aufgaben` zeigt persönlich adressierte Ereignisse der letzten sieben Tage. Fristmeldungen werden nicht dauerhaft dupliziert, sondern aus `dueDate`, Status, Wiedervorlage und Archivzustand berechnet: bald fällig bedeutet heute oder morgen; überfällig bedeutet ein Fristdatum vor dem heutigen Kalendertag. Dadurch wird eine Aufgabe mit Frist heute nicht schon um Mitternacht überfällig, und erledigte, zurückgestellte oder neu terminierte Warnungen verschwinden sofort.

Eine externe E-Mail-, Push- oder Scheduler-Infrastruktur wurde nicht eingeführt.

## Import und Export

Die bestehende Importpipeline (`ImportBatch`, `SourceReference`, Dry Run, Review und Commit) wurde erweitert. Die Aufgaben-Vorlage enthält Titel, Beschreibung, Bereich, Priorität, Status, Frist, Bearbeiter-E-Mail und Teamaufgabe.

Bearbeiter werden ausschließlich gegen aktive Memberships der aktuellen Organisation aufgelöst. Eine unbekannte E-Mail erzeugt im Dry Run einen zeilenbezogenen Fehler und verhindert den Commit. Der Commit erzeugt Aufgabe, Primary-Zuweisung, Importaktivität und die bestehende `SourceReference`.

Der Export enthält mehrere Bearbeiter, Primary, Ersteller, Aufgabenart, Checklistenfortschritt, Archiv, Wiedervorlage und Fachobjektreferenzen.

## Anhänge

Anhänge wurden bewusst nicht umgesetzt. Das Repository besitzt derzeit nur einen bildbezogenen Upload mit öffentlich adressierbarem Pfad und lokalem Fallback unter `public/uploads`. Es fehlt eine private Objektablage mit autorisierter Download-Route, Dateiscan und task-spezifischer Zugriffskontrolle. Erst eine solche Grundlage darf für Team-Anhänge verwendet werden.

## Testabdeckung

- Mehrfachzuweisung, Primary- und Tenant-Invarianten
- Checklisten- und Statusfortschritt
- Rollenrechte für READONLY, MEMBER, ADMIN und OWNER
- relationale Fachobjektlinks und Typ-/Tenant-Prüfung
- additive Migration und RLS für `task_domain_links`
- Aufgabenimport, unbekannte Nutzer und Vorlagenvertrag
- Wiedervorlage, Archiv und Aktivitäten zusätzlich durch Typecheck, Build und Browserprüfung der Actions/UI

## Bewusste Grenzen

- Keine externe Benachrichtigungs- oder E-Mail-Infrastruktur.
- Keine unsicheren Datei-Anhänge.
- Keine Migration oder Löschung von Legacy-Aufgaben; `assigneeId`, `progressPercent` und `scope = null` bleiben kompatibel.
- Keine neue Importengine und keine direkte Umgehung von `requireOrg`, RLS, `AuditLog`, `ImportBatch` oder `SourceReference`.
