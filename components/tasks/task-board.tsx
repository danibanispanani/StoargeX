"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { archiveTaskAction, moveTaskAction } from "@/lib/actions/tasks";
import { TASK_PRIORITY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  area: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  archived: boolean;
  dueDate: string | null;
  assigneeName: string | null;
}

const COLUMNS: Array<{ status: TaskStatus; title: string }> = [
  { status: "OPEN", title: "Offen" },
  { status: "IN_PROGRESS", title: "In Arbeit" },
  { status: "DONE", title: "Erledigt" },
];

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-amber-100 text-amber-800",
  URGENT: "bg-red-100 text-red-800",
};

export function TaskBoard({
  tasks,
  showArchived,
}: {
  tasks: BoardTask[];
  showArchived: boolean;
}) {
  const columnIndex = (status: TaskStatus) =>
    // Abgebrochene Aufgaben landen in der Erledigt-Spalte
    status === "CANCELLED" ? 2 : COLUMNS.findIndex((c) => c.status === status);

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {showArchived
            ? "Keine Aufgaben vorhanden – auch nicht im Archiv."
            : "Alles erledigt! Lege über „Aufgabe anlegen“ die nächste Aufgabe an."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((column, index) => {
        const columnTasks = tasks.filter((t) => columnIndex(t.status) === index);
        return (
          <Card key={column.status} className="bg-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {column.title}
                <Badge variant="secondary">{columnTasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {columnTasks.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Keine Aufgaben
                </p>
              )}
              {columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} columnIndex={index} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TaskCard({ task, columnIndex }: { task: BoardTask; columnIndex: number }) {
  const [pending, startTransition] = useTransition();

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due !== null && due < new Date() && task.status !== "DONE";

  function move(direction: -1 | 1) {
    const target = COLUMNS[columnIndex + direction]?.status;
    if (!target) return;
    startTransition(async () => {
      const result = await moveTaskAction(task.id, target);
      if (result?.error) toast.error(result.error);
    });
  }

  function archive(archived: boolean) {
    startTransition(async () => {
      const result = await archiveTaskAction(task.id, archived);
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border bg-background p-3 text-sm shadow-xs",
        task.archived && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{task.title}</span>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
            PRIORITY_STYLES[task.priority]
          )}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.area && <Badge variant="outline">{task.area}</Badge>}
        {task.status === "CANCELLED" && <Badge variant="outline">Abgebrochen</Badge>}
        {task.archived && <Badge variant="outline">Archiviert</Badge>}
        {task.assigneeName && <span>👤 {task.assigneeName}</span>}
        {due && (
          <span className={cn(overdue && "font-medium text-destructive")}>
            📅 {due.toLocaleDateString("de-DE")}
            {overdue && " (überfällig)"}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={pending || columnIndex === 0}
            onClick={() => move(-1)}
            title="Nach links verschieben"
          >
            ←
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={pending || columnIndex === 2}
            onClick={() => move(1)}
            title="Nach rechts verschieben"
          >
            →
          </Button>
        </div>
        {(task.status === "DONE" || task.status === "CANCELLED") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={pending}
            onClick={() => archive(!task.archived)}
          >
            {task.archived ? "Wiederherstellen" : "Archivieren"}
          </Button>
        )}
      </div>
    </div>
  );
}
