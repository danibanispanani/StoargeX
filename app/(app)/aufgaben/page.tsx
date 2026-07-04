import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskBoard, type BoardTask } from "@/components/tasks/task-board";
import { Button } from "@/components/ui/button";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ archiv?: string }>;
}) {
  const { db } = await requireOrg();
  const { archiv } = await searchParams;
  const showArchived = archiv === "1";

  const [tasks, members] = await Promise.all([
    db.task.findMany({
      where: { archived: showArchived ? undefined : false },
      include: { assignee: { select: { name: true, email: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 500,
    }),
    db.membership.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
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
    assigneeName: task.assignee ? task.assignee.name ?? task.assignee.email : null,
  }));

  const memberOptions = members.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Aufgaben</h1>
          <p className="text-sm text-muted-foreground">
            Kanban-Board – erledigte Aufgaben werden archiviert statt gelöscht.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={showArchived ? "/aufgaben" : "/aufgaben?archiv=1"}>
              {showArchived ? "Archiv ausblenden" : "Archiv anzeigen"}
            </Link>
          </Button>
          <CreateTaskDialog members={memberOptions} />
        </div>
      </div>

      <TaskBoard tasks={boardTasks} showArchived={showArchived} />
    </div>
  );
}
