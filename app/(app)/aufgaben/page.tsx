import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { getOptions } from "@/lib/options";
import { hasMinRole } from "@/lib/roles";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { ImportExportBar } from "@/components/import-export/import-export-bar";
import { TaskBoard, type BoardTask } from "@/components/tasks/task-board";
import { TaskMemberFilter } from "@/components/tasks/task-member-filter";
import { Button } from "@/components/ui/button";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ archiv?: string; zustaendig?: string }>;
}) {
  const { db, organization, membership, userId } = await requireOrg();
  const params = await searchParams;
  const showArchived = params.archiv === "1";
  const isManager = hasMinRole(membership.role, "ADMIN");

  // Sichtbarkeit: Mitglieder sehen eigene + "Alle"-Aufgaben,
  // OWNER/ADMIN sehen alles (optional nach Mitglied gefiltert)
  const visibilityWhere = isManager
    ? params.zustaendig === "alle"
      ? { assigneeId: null }
      : params.zustaendig
        ? { assigneeId: params.zustaendig }
        : {}
    : { OR: [{ assigneeId: userId }, { assigneeId: null }] };

  const [tasks, members, areaOptions] = await Promise.all([
    db.task.findMany({
      where: {
        ...(showArchived ? {} : { archived: false }),
        ...visibilityWhere,
      },
      include: { assignee: { select: { name: true, email: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 500,
    }),
    db.membership.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getOptions(db, organization.id, "TASK_AREA"),
  ]);

  const boardTasks: BoardTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    area: task.area,
    status: task.status,
    priority: task.priority,
    archived: task.archived,
    dueDate: task.dueDate?.toISOString() ?? null,
    assigneeName: task.assignee ? task.assignee.name ?? task.assignee.email : "Alle",
  }));

  const memberOptions = members.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email,
  }));

  const archivedToggleParams = new URLSearchParams();
  if (!showArchived) archivedToggleParams.set("archiv", "1");
  if (params.zustaendig) archivedToggleParams.set("zustaendig", params.zustaendig);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Aufgaben</h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? "Du siehst alle Aufgaben aller Mitglieder."
              : "Du siehst deine Aufgaben und gemeinsame („Alle“)."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager && (
            <TaskMemberFilter
              members={memberOptions}
              current={params.zustaendig ?? ""}
              showArchived={showArchived}
            />
          )}
          <Button asChild variant="outline">
            <Link href={`/aufgaben${archivedToggleParams.size ? `?${archivedToggleParams}` : ""}`}>
              {showArchived ? "Erledigte ausblenden" : "Erledigte anzeigen"}
            </Link>
          </Button>
          <ImportExportBar table="aufgaben" />
          <CreateTaskDialog members={memberOptions} areaOptions={areaOptions} />
        </div>
      </div>

      <TaskBoard tasks={boardTasks} showArchived={showArchived} />
    </div>
  );
}
