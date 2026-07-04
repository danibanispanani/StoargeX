"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createTaskAction } from "@/lib/actions/tasks";
import type { ActionState } from "@/lib/actions/team";
import { TASK_PRIORITY_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateTaskDialog({
  members,
}: {
  members: Array<{ userId: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createTaskAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Aufgabe anlegen</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aufgabe anlegen</DialogTitle>
          <DialogDescription>
            Neue Aufgabe fürs Kanban-Board.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="task-title">Titel *</Label>
            <Input id="task-title" name="title" required placeholder="Pakete zur Post bringen" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Beschreibung</Label>
            <Input id="task-desc" name="description" placeholder="optional" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-area">Bereich</Label>
              <Input
                id="task-area"
                name="area"
                list="task-areas"
                placeholder="Versand"
              />
              <datalist id="task-areas">
                <option value="Einkauf" />
                <option value="Verkauf" />
                <option value="Versand" />
                <option value="Buchhaltung" />
                <option value="Retouren" />
                <option value="Sonstiges" />
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-priority">Priorität</Label>
              <select
                id="task-priority"
                name="priority"
                defaultValue="MEDIUM"
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Frist</Label>
              <Input id="task-due" name="dueDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Zuständig</Label>
              <select
                id="task-assignee"
                name="assigneeId"
                defaultValue=""
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Niemand</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Wird gespeichert…" : "Aufgabe anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
