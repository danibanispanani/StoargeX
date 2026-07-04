"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { writeAuditLog } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/team";

const taskSchema = z.object({
  title: z.string().min(1, "Titel fehlt.").max(300),
  description: z.string().max(2000).optional().or(z.literal("")),
  area: z.string().max(100).optional().or(z.literal("")),
  priority: z.nativeEnum(TaskPriority).default("MEDIUM"),
  dueDate: z.string().optional().or(z.literal("")),
  assigneeId: z.string().optional().or(z.literal("")),
});

/** Aufgabe anlegen. Zuständiger muss Mitglied der Organisation sein. */
export async function createTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, organization, userId } = await requireOrg("MEMBER");

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    area: formData.get("area"),
    priority: formData.get("priority") || "MEDIUM",
    dueDate: formData.get("dueDate"),
    assigneeId: formData.get("assigneeId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const data = parsed.data;

  if (data.assigneeId) {
    const membership = await db.membership.findFirst({
      where: { userId: data.assigneeId },
    });
    if (!membership) {
      return { error: "Zuständige Person ist kein Mitglied der Organisation." };
    }
  }

  const task = await db.task.create({
    data: {
      organizationId: organization.id,
      title: data.title,
      description: data.description || null,
      area: data.area || null,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assigneeId: data.assigneeId || null,
      createdById: userId,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    userId,
    action: "task.create",
    entityType: "Task",
    entityId: task.id,
    after: { title: task.title, area: task.area },
  });

  revalidatePath("/aufgaben");
  return { success: "Aufgabe angelegt." };
}

/** Aufgabe im Kanban verschieben (Statuswechsel). */
export async function moveTaskAction(
  taskId: string,
  status: TaskStatus
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const parsed = z.nativeEnum(TaskStatus).safeParse(status);
  if (!parsed.success) return { error: "Ungültiger Status." };

  const task = await db.task.findFirst({ where: { id: taskId } });
  if (!task) return { error: "Aufgabe nicht gefunden." };

  await db.task.update({
    where: { id: taskId },
    data: {
      status: parsed.data,
      completedAt: parsed.data === "DONE" ? task.completedAt ?? new Date() : null,
    },
  });

  revalidatePath("/aufgaben");
  return { success: "Aufgabe verschoben." };
}

/** Erledigte Aufgaben archivieren statt löschen (bzw. wiederherstellen). */
export async function archiveTaskAction(
  taskId: string,
  archived: boolean
): Promise<ActionState> {
  const { db } = await requireOrg("MEMBER");

  const task = await db.task.findFirst({ where: { id: taskId } });
  if (!task) return { error: "Aufgabe nicht gefunden." };
  if (archived && task.status !== "DONE" && task.status !== "CANCELLED") {
    return { error: "Nur erledigte oder abgebrochene Aufgaben können archiviert werden." };
  }

  await db.task.update({
    where: { id: taskId },
    data: { archived },
  });

  revalidatePath("/aufgaben");
  return { success: archived ? "Aufgabe archiviert." : "Aufgabe wiederhergestellt." };
}

/** Mitglieder für die Zuständigen-Auswahl (Name + User-ID). */
export async function getAssignableMembers(): Promise<
  Array<{ userId: string; name: string }>
> {
  const { db } = await requireOrg();
  const memberships = await db.membership.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email,
  }));
}
