"use client";

import { useMemo, useState, useTransition } from "react";
import type { TaskPriority, TaskScope, TaskStatus } from "@prisma/client";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Link2, MessageSquare, Users } from "lucide-react";
import {
  addTaskChecklistItemAction,
  addTaskCommentAction,
  archiveTaskAction,
  moveTaskAction,
  snoozeTaskAction,
  toggleTaskChecklistItemAction,
  updateTaskAssignmentsAction,
  updateTaskDetailsAction,
} from "@/lib/actions/tasks";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_STYLES, TASK_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface TeamTaskRow {
  id: string;
  title: string;
  description: string | null;
  area: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  scope: TaskScope | null;
  archived: boolean;
  dueDate: string | null;
  snoozedUntil: string | null;
  creatorName: string;
  assignees: Array<{ userId: string; name: string; primary: boolean }>;
  checklist: Array<{ id: string; label: string; completed: boolean }>;
  progress: { mode: "CHECKLIST" | "STATUS"; completed: number; total: number; percent: number | null };
  activities: Array<{ id: string; action: string; message: string | null; actorName: string; createdAt: string }>;
  links: Array<{ type: string; label: string }>;
  canEdit: boolean;
  canArchive: boolean;
  canComment: boolean;
}

const COLUMNS: Array<{ status: TaskStatus; title: string }> = [
  { status: "OPEN", title: "Offen" },
  { status: "IN_PROGRESS", title: "In Arbeit" },
  { status: "DONE", title: "Erledigt" },
];

export interface TaskMemberOption { userId: string; name: string; email?: string }

export function TaskWorkspace({ tasks, display, members }: { tasks: TeamTaskRow[]; display: "kanban" | "liste"; members: TaskMemberOption[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((task) => task.id === selectedId) ?? null;

  if (tasks.length === 0) {
    return <div className="border-y bg-muted/15 px-4 py-14 text-center text-sm text-muted-foreground">Keine Aufgaben entsprechen dieser Ansicht.</div>;
  }

  return (
    <>
      {display === "liste" ? <TaskList tasks={tasks} onOpen={setSelectedId} /> : <TaskBoard tasks={tasks} onOpen={setSelectedId} />}
      <TaskDetail key={selected?.id ?? "closed"} task={selected} members={members} onOpenChange={(open) => !open && setSelectedId(null)} />
    </>
  );
}

function TaskBoard({ tasks, onOpen }: { tasks: TeamTaskRow[]; onOpen: (id: string) => void }) {
  const columnIndex = (status: TaskStatus) => status === "CANCELLED" ? 2 : COLUMNS.findIndex((column) => column.status === status);
  return <div className="grid gap-3 lg:grid-cols-3">{COLUMNS.map((column, index) => {
    const rows = tasks.filter((task) => columnIndex(task.status) === index);
    return <section key={column.status} className="min-w-0 border-t-2 bg-muted/15" aria-label={column.title}>
      <header className="flex items-center justify-between border-b px-3 py-2"><h2 className="text-sm font-semibold">{column.title}</h2><Badge variant="secondary">{rows.length}</Badge></header>
      <div className="space-y-2 p-2">{rows.length ? rows.map((task) => <TaskCard key={task.id} task={task} onOpen={onOpen} />) : <p className="py-8 text-center text-xs text-muted-foreground">Keine Aufgaben</p>}</div>
    </section>;
  })}</div>;
}

function TaskCard({ task, onOpen }: { task: TeamTaskRow; onOpen: (id: string) => void }) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const overdue = due && due < todayStart && !["DONE", "CANCELLED"].includes(task.status);
  return <button type="button" onClick={() => onOpen(task.id)} className={cn("w-full border bg-background p-3 text-left shadow-xs transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", task.archived && "opacity-60")}>
    <div className="flex items-start justify-between gap-2"><span className="font-medium leading-5">{task.title}</span><span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", TASK_PRIORITY_STYLES[task.priority])}>{TASK_PRIORITY_LABELS[task.priority]}</span></div>
    {task.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p> : null}
    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
      {task.area ? <Badge variant="outline">{task.area}</Badge> : null}
      {task.status === "CANCELLED" ? <Badge variant="outline">Abgebrochen</Badge> : null}
      <span className="inline-flex items-center gap-1"><Users className="size-3" />{task.assignees.length ? task.assignees.map((item) => item.name).join(", ") : "Unzugewiesen"}</span>
      {due ? <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}><CalendarClock className="size-3" />{due.toLocaleDateString("de-DE")}{overdue ? " überfällig" : ""}</span> : null}
    </div>
    {task.progress.mode === "CHECKLIST" ? <div className="mt-2"><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Checkliste</span><span>{task.progress.completed}/{task.progress.total}</span></div><div className="h-1 bg-muted"><div className="h-full bg-transit-teal" style={{ width: `${task.progress.percent ?? 0}%` }} /></div></div> : null}
  </button>;
}

function TaskList({ tasks, onOpen }: { tasks: TeamTaskRow[]; onOpen: (id: string) => void }) {
  return <div className="overflow-x-auto border-y"><table className="w-full min-w-[860px] text-sm"><thead className="sticky top-0 bg-muted/90 text-left text-xs"><tr><th className="px-3 py-2">Titel</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Priorität</th><th className="px-3 py-2">Bearbeiter</th><th className="px-3 py-2">Frist</th><th className="px-3 py-2">Bereich</th><th className="px-3 py-2">Fortschritt</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-t hover:bg-muted/30"><td className="p-0"><button type="button" onClick={() => onOpen(task.id)} className="w-full px-3 py-2 text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">{task.title}</button></td><td className="px-3 py-2">{TASK_STATUS_LABELS[task.status]}</td><td className="px-3 py-2">{TASK_PRIORITY_LABELS[task.priority]}</td><td className="px-3 py-2">{task.assignees.map((item) => item.name).join(", ") || "Unzugewiesen"}</td><td className="px-3 py-2 tabular-nums">{task.dueDate ? new Date(task.dueDate).toLocaleDateString("de-DE") : "—"}</td><td className="px-3 py-2">{task.area ?? "—"}</td><td className="px-3 py-2">{task.progress.mode === "CHECKLIST" ? `${task.progress.completed}/${task.progress.total}` : task.progress.percent === 100 ? "Erledigt" : "Statusgeführt"}</td></tr>)}</tbody></table></div>;
}

function TaskDetail({ task, members, onOpenChange }: { task: TeamTaskRow | null; members: TaskMemberOption[]; onOpenChange: (open: boolean) => void }) {
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [checklistLabel, setChecklistLabel] = useState("");
  const [snooze, setSnooze] = useState("");
  const [assignmentScope, setAssignmentScope] = useState<"PERSONAL" | "TEAM">(task?.scope === "TEAM" ? "TEAM" : "PERSONAL");
  const [assignmentIds, setAssignmentIds] = useState<string[]>(task?.assignees.map((item) => item.userId) ?? []);
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState(task?.assignees.find((item) => item.primary)?.userId ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [area, setArea] = useState(task?.area ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) ?? "");
  const assigneeLabel = useMemo(() => task?.assignees.map((item) => `${item.name}${item.primary ? " (primär)" : ""}`).join(", ") ?? "", [task]);
  if (!task) return null;

  function run(action: () => Promise<{ error?: string; success?: string } | null>, after?: () => void) {
    startTransition(async () => { const result = await action(); if (result?.error) toast.error(result.error); else { if (result?.success) toast.success(result.success); after?.(); } });
  }
  return <Dialog open onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{task.title}</DialogTitle><DialogDescription>{task.scope === "TEAM" ? "Teamaufgabe" : task.scope === "PERSONAL" ? "Persönliche Aufgabe" : "Legacy-Aufgabe"} · Erstellt von {task.creatorName}</DialogDescription></DialogHeader>
    <div className="grid gap-5 md:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-5">
        {task.description ? <section><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beschreibung</h3><p className="mt-1 whitespace-pre-wrap text-sm">{task.description}</p></section> : null}
        <section><div className="flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-sm font-semibold"><CheckCircle2 className="size-4" /> Checkliste</h3>{task.progress.mode === "CHECKLIST" ? <span className="text-xs tabular-nums text-muted-foreground">{task.progress.completed}/{task.progress.total} · {task.progress.percent}%</span> : null}</div>
          <div className="mt-2 space-y-1">{task.checklist.map((item) => <label key={item.id} className="flex items-start gap-2 border-b py-2 text-sm"><Checkbox checked={item.completed} disabled={!task.canEdit || pending} onCheckedChange={(checked) => run(() => toggleTaskChecklistItemAction(item.id, checked === true))} /><span className={cn(item.completed && "text-muted-foreground line-through")}>{item.label}</span></label>)}{task.checklist.length === 0 ? <p className="text-xs text-muted-foreground">Keine Checkliste; der Status beschreibt den Fortschritt.</p> : null}</div>
          {task.canEdit ? <div className="mt-2 flex gap-2"><Input value={checklistLabel} onChange={(event) => setChecklistLabel(event.target.value)} placeholder="Checklistenpunkt ergänzen" /><Button variant="outline" disabled={pending || !checklistLabel.trim()} onClick={() => run(() => addTaskChecklistItemAction(task.id, checklistLabel), () => setChecklistLabel(""))}>Hinzufügen</Button></div> : null}
        </section>
        <section><h3 className="flex items-center gap-1.5 text-sm font-semibold"><MessageSquare className="size-4" /> Aktivität & Kommentare</h3><div className="mt-2 max-h-64 space-y-2 overflow-y-auto">{task.activities.map((activity) => <div key={activity.id} className="border-l-2 pl-3 text-sm"><p><span className="font-medium">{activity.actorName}</span> · {activity.action}</p>{activity.message ? <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{activity.message}</p> : null}<time className="text-[11px] text-muted-foreground">{new Date(activity.createdAt).toLocaleString("de-DE")}</time></div>)}</div>
          {task.canComment ? <div className="mt-3 flex gap-2"><Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Kommentar schreiben" maxLength={2000} /><Button disabled={pending || !comment.trim()} onClick={() => run(() => addTaskCommentAction(task.id, comment), () => setComment(""))}>Senden</Button></div> : null}
        </section>
      </div>
      <aside className="space-y-4 text-sm md:border-l md:pl-4">
        <dl className="space-y-3"><div><dt className="text-xs text-muted-foreground">Status</dt><dd>{task.canEdit ? <select value={task.status} disabled={pending} onChange={(event) => run(() => moveTaskAction(task.id, event.target.value as TaskStatus))} className="border-input mt-1 h-9 w-full rounded-md border bg-background px-2"><option value="OPEN">Offen</option><option value="IN_PROGRESS">In Arbeit</option><option value="DONE">Erledigt</option><option value="CANCELLED">Abgebrochen</option></select> : TASK_STATUS_LABELS[task.status]}</dd></div><div><dt className="text-xs text-muted-foreground">Bearbeiter</dt><dd>{assigneeLabel || "Unzugewiesen"}</dd></div><div><dt className="text-xs text-muted-foreground">Frist</dt><dd>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("de-DE") : "Keine"}</dd></div><div><dt className="text-xs text-muted-foreground">Bereich</dt><dd>{task.area ?? "Nicht gesetzt"}</dd></div></dl>
        {task.links.length ? <section><h3 className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"><Link2 className="size-3" /> Verknüpft</h3>{task.links.map((link) => <p key={`${link.type}:${link.label}`} className="mt-1">{link.label}</p>)}</section> : null}
        {task.canEdit ? <section className="space-y-2 border-t pt-3"><h3 className="text-xs font-semibold uppercase text-muted-foreground">Aufgabendaten</h3><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} aria-label="Titel" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={3} aria-label="Beschreibung" className="border-input w-full rounded-md border bg-background px-3 py-2 text-sm" /><Input value={area} onChange={(event) => setArea(event.target.value)} maxLength={100} aria-label="Bereich" /><select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} aria-label="Priorität" className="border-input h-9 w-full rounded-md border bg-background px-2"><option value="LOW">Niedrig</option><option value="MEDIUM">Mittel</option><option value="HIGH">Hoch</option><option value="URGENT">Dringend</option></select><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Frist" /><Button size="sm" variant="outline" className="w-full" disabled={pending || !title.trim()} onClick={() => run(() => updateTaskDetailsAction(task.id, { title, description: description || null, area: area || null, priority, dueDate: dueDate || null }))}>Aufgabendaten speichern</Button></section> : null}
        {task.canEdit ? <section className="space-y-2 border-t pt-3"><h3 className="text-xs font-semibold uppercase text-muted-foreground">Zuweisung</h3><select value={assignmentScope} onChange={(event) => setAssignmentScope(event.target.value as "PERSONAL" | "TEAM")} className="border-input h-9 w-full rounded-md border bg-background px-2"><option value="PERSONAL">Persönlich</option><option value="TEAM">Teamaufgabe</option></select><div className="max-h-40 space-y-1 overflow-y-auto border-y py-2">{members.map((member) => <label key={member.userId} className="flex items-center gap-2 text-xs"><Checkbox checked={assignmentIds.includes(member.userId)} onCheckedChange={(checked) => { setAssignmentIds((current) => checked === true ? [...new Set([...current, member.userId])] : current.filter((id) => id !== member.userId)); if (checked !== true && primaryAssigneeId === member.userId) setPrimaryAssigneeId(""); }} /><span>{member.name}</span></label>)}</div><select value={primaryAssigneeId} onChange={(event) => setPrimaryAssigneeId(event.target.value)} className="border-input h-9 w-full rounded-md border bg-background px-2"><option value="">Primary automatisch wählen</option>{members.filter((member) => assignmentIds.includes(member.userId)).map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select><Button size="sm" variant="outline" className="w-full" disabled={pending || (assignmentScope === "PERSONAL" && assignmentIds.length !== 1)} onClick={() => run(() => updateTaskAssignmentsAction(task.id, assignmentScope, assignmentIds, primaryAssigneeId || null))}>Zuweisung speichern</Button></section> : null}
        {task.canEdit ? <section className="space-y-2 border-t pt-3"><h3 className="text-xs font-semibold uppercase text-muted-foreground">Wiedervorlage</h3><Input type="date" value={snooze} onChange={(event) => setSnooze(event.target.value)} /><div className="flex gap-1"><Button size="sm" variant="outline" disabled={pending || !snooze} onClick={() => run(() => snoozeTaskAction(task.id, snooze))}>Setzen</Button>{task.snoozedUntil ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => snoozeTaskAction(task.id, null))}>Entfernen</Button> : null}</div></section> : null}
        {task.canArchive && (["DONE", "CANCELLED"].includes(task.status) || task.archived) ? <Button className="w-full" variant="outline" disabled={pending} onClick={() => run(() => archiveTaskAction(task.id, !task.archived))}>{task.archived ? "Wiederherstellen" : "Archivieren"}</Button> : null}
      </aside>
    </div>
  </DialogContent></Dialog>;
}
