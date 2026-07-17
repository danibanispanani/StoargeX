import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { getOptions } from "@/lib/options";
import { hasMinRole } from "@/lib/roles";
import { canPerformTaskAction } from "@/lib/services/task-permission-policy";
import { deriveTaskProgress } from "@/lib/services/task-workflow-service";
import { CreateTaskDialog, type TaskDomainOption } from "@/components/tasks/create-task-dialog";
import { TaskWorkspace, type TeamTaskRow } from "@/components/tasks/task-workspace";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { PageHeader } from "@/components/app/page-header";
import { PageToolbar } from "@/components/app/page-toolbar";
import { InsightStrip } from "@/components/app/insight-strip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TaskView = "meine" | "team" | "zugewiesen" | "mitglied" | "bereich" | "faellig" | "erledigt" | "archiv";
interface TaskSearchParams {
  view?: string;
  darstellung?: string;
  q?: string;
  status?: string;
  prioritaet?: string;
  member?: string;
  area?: string;
  sort?: string;
  dir?: string;
}

const VIEWS: Array<{ key: TaskView; label: string }> = [
  { key: "meine", label: "Meine Aufgaben" },
  { key: "team", label: "Team" },
  { key: "zugewiesen", label: "Von mir zugewiesen" },
  { key: "mitglied", label: "Nach Mitglied" },
  { key: "bereich", label: "Nach Bereich" },
  { key: "faellig", label: "Fällig" },
  { key: "erledigt", label: "Erledigt" },
  { key: "archiv", label: "Archiv" },
];

function validEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && allowed.includes(value as T) ? value as T : undefined;
}

function activityLabel(action: string): string {
  return ({
    CREATED: "hat die Aufgabe angelegt",
    ASSIGNED: "hat die Aufgabe neu zugewiesen",
    IMPORTED: "hat die Aufgabe importiert",
    STATUS_CHANGED: "hat den Status geändert",
    DETAILS_CHANGED: "hat die Aufgabendaten geändert",
    COMMENTED: "hat kommentiert",
    CHECKLIST_CHANGED: "hat die Checkliste aktualisiert",
    SNOOZED: "hat eine Wiedervorlage gesetzt",
    ARCHIVED: "hat die Aufgabe archiviert",
    RESTORED: "hat die Aufgabe wiederhergestellt",
  } as Record<string, string>)[action] ?? "hat die Aufgabe aktualisiert";
}

function activityRecipientIds(details: Prisma.JsonValue): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const value = (details as Record<string, Prisma.JsonValue>).recipientIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function detailsMessage(details: Prisma.JsonValue): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = (details as Record<string, Prisma.JsonValue>).message;
  return typeof value === "string" ? value : null;
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskSearchParams> }) {
  const { db, organization, membership, userId } = await requireOrg();
  const params = await searchParams;
  const view = validEnum(params.view, VIEWS.map((item) => item.key)) ?? "meine";
  const display = params.darstellung === "liste" ? "liste" : "kanban";
  const isManager = hasMinRole(membership.role, "ADMIN");
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dueSoonExclusive = new Date(todayStart);
  dueSoonExclusive.setDate(dueSoonExclusive.getDate() + 2);
  const activeSnoozeWhere: Prisma.TaskWhereInput = { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] };

  const visibilityWhere: Prisma.TaskWhereInput = isManager ? {} : {
    OR: [
      { scope: "TEAM" },
      { createdById: userId },
      { assignments: { some: { userId } } },
      { assigneeId: userId },
      { scope: null, assigneeId: null },
    ],
  };
  const viewWhere: Prisma.TaskWhereInput = (() => {
    switch (view) {
      case "team": return { scope: "TEAM", archived: false };
      case "zugewiesen": return { activities: { some: { actorId: userId, action: "ASSIGNED" } }, archived: false };
      case "mitglied": return params.member ? { assignments: { some: { userId: params.member } }, archived: false } : { archived: false };
      case "bereich": return params.area ? { area: params.area, archived: false } : { archived: false };
      case "faellig": return { archived: false, dueDate: { lt: dueSoonExclusive }, status: { notIn: ["DONE", "CANCELLED"] } };
      case "erledigt": return { archived: false, status: { in: ["DONE", "CANCELLED"] } };
      case "archiv": return { archived: true };
      default: return { archived: false, OR: [{ assignments: { some: { userId } } }, { assigneeId: userId }, { createdById: userId }] };
    }
  })();
  const status = validEnum(params.status, ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const);
  const priority = validEnum(params.prioritaet, ["LOW", "MEDIUM", "HIGH", "URGENT"] as const);
  const queryWhere: Prisma.TaskWhereInput = {
    AND: [
      visibilityWhere,
      viewWhere,
      ...(view === "archiv" || view === "erledigt" ? [] : [activeSnoozeWhere]),
      ...(params.q?.trim() ? [{ OR: [
        { title: { contains: params.q.trim(), mode: "insensitive" as const } },
        { description: { contains: params.q.trim(), mode: "insensitive" as const } },
        { area: { contains: params.q.trim(), mode: "insensitive" as const } },
        { domainLinks: { some: { labelSnapshot: { contains: params.q.trim(), mode: "insensitive" as const } } } },
      ] }] : []),
      ...(status ? [{ status }] : []),
      ...(priority ? [{ priority }] : []),
    ],
  };
  const sortKey = validEnum(params.sort, ["dueDate", "createdAt", "updatedAt", "title", "priority", "status"] as const) ?? "dueDate";
  const direction = params.dir === "desc" ? "desc" : "asc";
  const orderBy = [{ [sortKey]: direction }, { createdAt: "desc" }] as Prisma.TaskOrderByWithRelationInput[];

  const [tasks, members, areaOptions, purchases, inventory, sales, customerReturns, supplierReturns, debts, recentActivities, overdueCount, dueSoonCount, myOpenCount, teamOpenCount] = await Promise.all([
    db.task.findMany({
      where: queryWhere,
      include: {
        createdBy: { select: { name: true, email: true } },
        assignee: { select: { name: true, email: true } },
        assignments: { include: { user: { select: { name: true, email: true } } }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] },
        checklistItems: { orderBy: { position: "asc" } },
        activities: { include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
        domainLinks: true,
      },
      orderBy,
      take: 500,
    }),
    db.membership.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    getOptions(db, organization.id, "TASK_AREA"),
    db.purchase.findMany({ select: { id: true, purchaseNumber: true }, orderBy: { purchaseDate: "desc" }, take: 30 }),
    db.inventoryPosition.findMany({ select: { id: true, inventoryNumber: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.sale.findMany({ select: { id: true, orderNumber: true }, orderBy: { soldAt: "desc" }, take: 30 }),
    db.return.findMany({ select: { id: true, returnNumber: true }, orderBy: { requestedAt: "desc" }, take: 30 }),
    db.supplierReturn.findMany({ select: { id: true, returnNumber: true }, orderBy: { requestedAt: "desc" }, take: 30 }),
    db.debt.findMany({ select: { id: true, debtNumber: true, refId: true }, orderBy: { debtDate: "desc" }, take: 30 }),
    db.taskActivity.findMany({
      where: { task: visibilityWhere, createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      include: { task: { select: { title: true } }, actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.task.count({ where: { AND: [visibilityWhere, activeSnoozeWhere, { archived: false, dueDate: { lt: todayStart }, status: { notIn: ["DONE", "CANCELLED"] } }] } }),
    db.task.count({ where: { AND: [visibilityWhere, activeSnoozeWhere, { archived: false, dueDate: { gte: todayStart, lt: dueSoonExclusive }, status: { notIn: ["DONE", "CANCELLED"] } }] } }),
    db.task.count({ where: { archived: false, status: { notIn: ["DONE", "CANCELLED"] }, OR: [{ assignments: { some: { userId } } }, { assigneeId: userId }] } }),
    db.task.count({ where: { scope: "TEAM", archived: false, status: { notIn: ["DONE", "CANCELLED"] } } }),
  ]);

  const rows: TeamTaskRow[] = tasks.map((task) => {
    const assignees = task.assignments.length
      ? task.assignments.map((assignment) => ({ userId: assignment.userId, name: assignment.user.name ?? assignment.user.email, primary: assignment.role === "PRIMARY" }))
      : task.assigneeId ? [{ userId: task.assigneeId, name: task.assignee?.name ?? task.assignee?.email ?? "Legacy-Bearbeiter", primary: true }] : [];
    const permissionBase = { role: membership.role, actorId: userId, creatorId: task.createdById, primaryAssigneeId: assignees.find((item) => item.primary)?.userId, assigneeIds: assignees.map((item) => item.userId), scope: task.scope };
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      area: task.area,
      status: task.status,
      priority: task.priority,
      scope: task.scope,
      archived: task.archived,
      dueDate: task.dueDate?.toISOString() ?? null,
      snoozedUntil: task.snoozedUntil?.toISOString() ?? null,
      creatorName: task.createdBy.name ?? task.createdBy.email,
      assignees,
      checklist: task.checklistItems.map((item) => ({ id: item.id, label: item.label, completed: item.completed })),
      progress: deriveTaskProgress({ status: task.status, checklist: task.checklistItems }),
      activities: task.activities.map((activity) => ({ id: activity.id, action: activityLabel(activity.action), message: detailsMessage(activity.details), actorName: activity.actor?.name ?? activity.actor?.email ?? "System", createdAt: activity.createdAt.toISOString() })),
      links: task.domainLinks.map((link) => ({ type: link.type, label: link.labelSnapshot ?? link.type })),
      canEdit: canPerformTaskAction({ ...permissionBase, action: "EDIT" }),
      canArchive: canPerformTaskAction({ ...permissionBase, action: "ARCHIVE" }),
      canComment: canPerformTaskAction({ ...permissionBase, action: "COMMENT" }),
    };
  });

  const memberOptions = members.map((item) => ({ userId: item.userId, name: item.user.name ?? item.user.email, email: item.user.email }));
  const domainOptions: TaskDomainOption[] = [
    ...purchases.map((item) => ({ value: `PURCHASE:${item.id}`, label: item.purchaseNumber, group: "Einkauf" })),
    ...inventory.map((item) => ({ value: `INVENTORY_POSITION:${item.id}`, label: item.inventoryNumber, group: "Lager" })),
    ...sales.map((item) => ({ value: `SALE:${item.id}`, label: item.orderNumber ?? item.id, group: "Verkauf" })),
    ...customerReturns.map((item) => ({ value: `CUSTOMER_RETURN:${item.id}`, label: item.returnNumber ?? item.id, group: "Kundenretoure" })),
    ...supplierReturns.map((item) => ({ value: `SUPPLIER_RETURN:${item.id}`, label: item.returnNumber ?? item.id, group: "Lieferantenretoure" })),
    ...debts.map((item) => ({ value: `DEBT:${item.id}`, label: item.debtNumber ?? item.refId ?? item.id, group: "Schuld" })),
  ];
  const canCreate = canPerformTaskAction({ role: membership.role, actorId: userId, action: "CREATE" });
  const notifications = recentActivities.filter((activity) => activity.actorId !== userId && activityRecipientIds(activity.details).includes(userId)).slice(0, 12);

  return <div className="space-y-4">
    <PageHeader eyebrow="Betrieb / Zusammenarbeit" title="Aufgaben" description="Verantwortung, Fristen und Fortschritt für persönliche Arbeit und das gesamte Team." actions={<>{canCreate ? <CreateTaskDialog members={memberOptions} areaOptions={areaOptions} domainOptions={domainOptions} /> : null}<ImportExportBar table="aufgaben" /></>} />
    <InsightStrip items={[
      { label: "Meine offenen", value: String(myOpenCount), detail: "mir zugewiesen", href: "/aufgaben?view=meine" },
      { label: "Team offen", value: String(teamOpenCount), detail: "gemeinsamer Arbeitsvorrat", href: "/aufgaben?view=team" },
      { label: "Bald fällig", value: String(dueSoonCount), detail: "heute oder morgen", tone: dueSoonCount ? "warning" : "neutral", href: "/aufgaben?view=faellig" },
      { label: "Überfällig", value: String(overdueCount), detail: "benötigt Aufmerksamkeit", tone: overdueCount ? "critical" : "neutral", href: "/aufgaben?view=faellig" },
    ]} />
    {notifications.length ? <details className="border-y bg-muted/15 px-3 py-2"><summary className="cursor-pointer text-sm font-medium">{notifications.length} neue Team-Hinweise der letzten 7 Tage</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{notifications.map((activity) => <Link key={activity.id} href={`/aufgaben?view=meine&q=${encodeURIComponent(activity.task.title)}`} className="border-l-2 border-l-transit-teal bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-medium">{activity.task.title}</span><span className="block text-xs text-muted-foreground">{activity.actor?.name ?? activity.actor?.email ?? "System"} {activityLabel(activity.action)} · {activity.createdAt.toLocaleString("de-DE")}</span></Link>)}</div></details> : null}
    <nav className="flex gap-1 overflow-x-auto border-b pb-1" aria-label="Aufgabenansichten">{VIEWS.map((item) => <Button key={item.key} asChild variant={view === item.key ? "default" : "ghost"} size="sm"><Link href={`/aufgaben?view=${item.key}&darstellung=${display}`}>{item.label}</Link></Button>)}</nav>
    <PageToolbar primary={<form action="/aufgaben" className="flex flex-1 flex-wrap items-center gap-1.5"><input type="hidden" name="view" value={view} /><input type="hidden" name="darstellung" value={display} /><Input name="q" defaultValue={params.q ?? ""} placeholder="Titel, Beschreibung, Bereich, Referenz" className="min-w-52 max-w-sm" /><select name="status" defaultValue={status ?? ""} className="border-input h-9 rounded-md border bg-background px-2 text-sm"><option value="">Alle Status</option><option value="OPEN">Offen</option><option value="IN_PROGRESS">In Arbeit</option><option value="DONE">Erledigt</option><option value="CANCELLED">Abgebrochen</option></select><select name="prioritaet" defaultValue={priority ?? ""} className="border-input h-9 rounded-md border bg-background px-2 text-sm"><option value="">Alle Prioritäten</option><option value="URGENT">Dringend</option><option value="HIGH">Hoch</option><option value="MEDIUM">Mittel</option><option value="LOW">Niedrig</option></select>{view === "mitglied" ? <select name="member" defaultValue={params.member ?? ""} className="border-input h-9 rounded-md border bg-background px-2 text-sm"><option value="">Alle Mitglieder</option>{memberOptions.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select> : null}{view === "bereich" ? <select name="area" defaultValue={params.area ?? ""} className="border-input h-9 rounded-md border bg-background px-2 text-sm"><option value="">Alle Bereiche</option>{areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}</select> : null}<select name="sort" defaultValue={sortKey} className="border-input h-9 rounded-md border bg-background px-2 text-sm"><option value="dueDate">Frist</option><option value="priority">Priorität</option><option value="updatedAt">Aktualisiert</option><option value="createdAt">Erstellt</option><option value="title">Titel</option><option value="status">Status</option></select><select name="dir" defaultValue={direction} className="border-input h-9 rounded-md border bg-background px-2 text-sm"><option value="asc">Aufsteigend</option><option value="desc">Absteigend</option></select><Button type="submit" variant="outline">Anwenden</Button></form>} secondary={<div className="flex gap-1"><Button asChild variant={display === "kanban" ? "secondary" : "ghost"} size="sm"><Link href={`/aufgaben?view=${view}&darstellung=kanban`}>Kanban</Link></Button><Button asChild variant={display === "liste" ? "secondary" : "ghost"} size="sm"><Link href={`/aufgaben?view=${view}&darstellung=liste`}>Liste</Link></Button></div>} />
    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{rows.length} Aufgaben in dieser Ansicht</span><span>Ansicht, Filter und Sortierung sind URL-basiert</span></div>
    <TaskWorkspace tasks={rows} display={display} members={memberOptions} />
  </div>;
}
