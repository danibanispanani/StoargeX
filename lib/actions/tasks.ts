"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  TaskDomainLinkType,
  TaskPriority,
  TaskScope,
  TaskStatus,
  type Role,
} from "@prisma/client";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/team";
import {
  canPerformTaskAction,
  taskPermissionMessage,
  type TaskAction,
} from "@/lib/services/task-permission-policy";
import {
  deriveTaskProgress,
  taskDomainLinkData,
  validateTaskDomainLink,
  type TaskDomainTarget,
} from "@/lib/services/task-workflow-service";
import {
  TaskAssignmentInvariantError,
  validateTaskAssignments,
} from "@/lib/services/task-assignment-service";

const taskSchema = z.object({
  title: z.string().trim().min(1, "Titel fehlt.").max(300),
  description: z.string().trim().max(5000).optional(),
  area: z.string().trim().max(100).optional(),
  priority: z.nativeEnum(TaskPriority).default("MEDIUM"),
  scope: z.nativeEnum(TaskScope).default("PERSONAL"),
  dueDate: z.string().optional(),
  primaryAssigneeId: z.string().optional(),
  domainLink: z.string().optional(),
  checklist: z.string().max(5000).optional(),
});

const taskDetailsSchema = z.object({
  title: z.string().trim().min(1, "Titel fehlt.").max(300),
  description: z.string().trim().max(5000).nullable(),
  area: z.string().trim().max(100).nullable(),
  priority: z.nativeEnum(TaskPriority),
  dueDate: z.string().nullable(),
});

type TaskWithAssignments = {
  id: string;
  createdById: string;
  scope: TaskScope | null;
  status: TaskStatus;
  completedAt: Date | null;
  assigneeId: string | null;
  assignments: Array<{ userId: string; role: "PRIMARY" | "COLLABORATOR" }>;
};

function taskAssigneeIds(task: TaskWithAssignments): string[] {
  return task.assignments.length
    ? task.assignments.map((item) => item.userId)
    : task.assigneeId
      ? [task.assigneeId]
      : [];
}

function permissionInput(
  task: TaskWithAssignments,
  actorId: string,
  role: Role,
  action: TaskAction
) {
  return {
    role,
    action,
    actorId,
    creatorId: task.createdById,
    scope: task.scope,
    assigneeIds: taskAssigneeIds(task),
    primaryAssigneeId: task.assignments.find((item) => item.role === "PRIMARY")?.userId ?? task.assigneeId,
  };
}

function parseChecklist(value?: string): string[] {
  return [...new Set((value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].slice(0, 50);
}

function parseDomainLink(value?: string): { type: TaskDomainLinkType; id: string } | null {
  if (!value) return null;
  const [rawType, id] = value.split(":", 2);
  const type = z.nativeEnum(TaskDomainLinkType).safeParse(rawType);
  return type.success && id ? { type: type.data, id } : null;
}

async function resolveDomainTarget(
  db: Awaited<ReturnType<typeof requireOrg>>["db"],
  organizationId: string,
  link: { type: TaskDomainLinkType; id: string }
): Promise<(TaskDomainTarget & { label: string }) | null> {
  switch (link.type) {
    case "PURCHASE": {
      const row = await db.purchase.findFirst({ where: { id: link.id }, select: { id: true, organizationId: true, purchaseNumber: true } });
      return row ? { type: link.type, id: row.id, organizationId: row.organizationId, label: row.purchaseNumber } : null;
    }
    case "INVENTORY_POSITION": {
      const row = await db.inventoryPosition.findFirst({ where: { id: link.id }, select: { id: true, organizationId: true, inventoryNumber: true } });
      return row ? { type: link.type, id: row.id, organizationId: row.organizationId, label: row.inventoryNumber } : null;
    }
    case "SALE": {
      const row = await db.sale.findFirst({ where: { id: link.id }, select: { id: true, organizationId: true, orderNumber: true } });
      return row ? { type: link.type, id: row.id, organizationId: row.organizationId, label: row.orderNumber ?? row.id } : null;
    }
    case "CUSTOMER_RETURN": {
      const row = await db.return.findFirst({ where: { id: link.id }, select: { id: true, organizationId: true, returnNumber: true } });
      return row ? { type: link.type, id: row.id, organizationId: row.organizationId, label: row.returnNumber ?? row.id } : null;
    }
    case "SUPPLIER_RETURN": {
      const row = await db.supplierReturn.findFirst({ where: { id: link.id }, select: { id: true, organizationId: true, returnNumber: true } });
      return row ? { type: link.type, id: row.id, organizationId: row.organizationId, label: row.returnNumber ?? row.id } : null;
    }
    case "DEBT": {
      const row = await db.debt.findFirst({ where: { id: link.id }, select: { id: true, organizationId: true, debtNumber: true, refId: true } });
      return row ? { type: link.type, id: row.id, organizationId: row.organizationId, label: row.debtNumber ?? row.refId ?? row.id } : null;
    }
  }
}

async function loadTaskForAction(taskId: string, action: TaskAction) {
  const context = await requireOrg();
  const task = await context.db.task.findFirst({
    where: { id: taskId },
    include: { assignments: { select: { userId: true, role: true } } },
  });
  if (!task) return { context, error: "Aufgabe nicht gefunden." } as const;
  if (!canPerformTaskAction(permissionInput(task, context.userId, context.membership.role, action))) {
    return { context, task, error: taskPermissionMessage(action) } as const;
  }
  return { context, task, error: null } as const;
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await requireOrg();
  if (!canPerformTaskAction({ role: context.membership.role, action: "CREATE", actorId: context.userId })) {
    return { error: taskPermissionMessage("CREATE") };
  }
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    area: formData.get("area") || undefined,
    priority: formData.get("priority") || "MEDIUM",
    scope: formData.get("scope") || "PERSONAL",
    dueDate: formData.get("dueDate") || undefined,
    primaryAssigneeId: formData.get("primaryAssigneeId") || undefined,
    domainLink: formData.get("domainLink") || undefined,
    checklist: formData.get("checklist") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) return { error: "Die Frist ist ungültig." };

  const assigneeIds = [...new Set(formData.getAll("assigneeIds").map(String).filter(Boolean))];
  const primaryId = parsed.data.primaryAssigneeId || (parsed.data.scope === "PERSONAL" ? context.userId : assigneeIds[0]);
  if (primaryId && !assigneeIds.includes(primaryId)) assigneeIds.unshift(primaryId);
  if (parsed.data.scope === "PERSONAL" && assigneeIds.length === 0) assigneeIds.push(context.userId);
  const memberships = assigneeIds.length
    ? await context.db.membership.findMany({ where: { userId: { in: assigneeIds } }, select: { userId: true, organizationId: true } })
    : [];
  if (memberships.length !== assigneeIds.length) return { error: "Mindestens eine zugewiesene Person ist kein aktives Teammitglied." };
  const assignments = memberships.map((membership) => ({
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.userId === primaryId ? "PRIMARY" as const : "COLLABORATOR" as const,
  }));
  try {
    validateTaskAssignments({ organizationId: context.organization.id, scope: parsed.data.scope, assignments });
  } catch (error) {
    return { error: error instanceof TaskAssignmentInvariantError ? error.message : "Zuweisung ist ungültig." };
  }

  const parsedLink = parseDomainLink(parsed.data.domainLink);
  const target = parsedLink ? await resolveDomainTarget(context.db, context.organization.id, parsedLink) : null;
  if (parsedLink && !target) return { error: "Das verknüpfte Fachobjekt wurde nicht gefunden." };
  if (target) validateTaskDomainLink({ organizationId: context.organization.id, type: target.type, targets: [target] });
  const checklist = parseChecklist(parsed.data.checklist);
  const task = await context.db.task.create({
    data: {
      organizationId: context.organization.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      area: parsed.data.area || null,
      priority: parsed.data.priority,
      scope: parsed.data.scope,
      dueDate,
      assigneeId: primaryId || null,
      createdById: context.userId,
      assignments: { create: assignments.map((item) => ({ organizationId: context.organization.id, userId: item.userId, role: item.role })) },
      checklistItems: { create: checklist.map((label, position) => ({ organizationId: context.organization.id, label, position })) },
      activities: { create: { organizationId: context.organization.id, actorId: context.userId, action: assigneeIds.length ? "ASSIGNED" : "CREATED", details: { recipientIds: assigneeIds } } },
      ...(target ? { domainLinks: { create: { organizationId: context.organization.id, type: target.type, labelSnapshot: target.label, ...taskDomainLinkData(target.type, target.id) } } } : {}),
    },
  });
  await writeAuditLog({ organizationId: context.organization.id, userId: context.userId, action: "task.create", entityType: "Task", entityId: task.id, after: { title: task.title, scope: task.scope, assigneeIds } });
  revalidatePath("/aufgaben");
  return { success: "Aufgabe angelegt." };
}

export async function moveTaskAction(taskId: string, status: TaskStatus): Promise<ActionState> {
  const parsed = z.nativeEnum(TaskStatus).safeParse(status);
  if (!parsed.success) return { error: "Ungültiger Status." };
  const access = await loadTaskForAction(taskId, "EDIT");
  if (access.error || !access.task) return { error: access.error };
  const recipientIds = taskAssigneeIds(access.task).filter((id) => id !== access.context.userId);
  await access.context.db.task.update({
    where: { id: taskId },
    data: {
      status: parsed.data,
      completedAt: parsed.data === "DONE" ? access.task.completedAt ?? new Date() : null,
      progressPercent: parsed.data === "DONE" ? 100 : 0,
      activities: { create: { organizationId: access.context.organization.id, actorId: access.context.userId, action: "STATUS_CHANGED", details: { from: access.task.status, to: parsed.data, recipientIds } } },
    },
  });
  revalidatePath("/aufgaben");
  return { success: "Status aktualisiert." };
}

export async function updateTaskDetailsAction(
  taskId: string,
  input: {
    title: string;
    description: string | null;
    area: string | null;
    priority: TaskPriority;
    dueDate: string | null;
  }
): Promise<ActionState> {
  const access = await loadTaskForAction(taskId, "EDIT");
  if (access.error || !access.task) return { error: access.error };
  const parsed = taskDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Die Aufgabendaten sind ungültig." };
  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) return { error: "Die Frist ist ungültig." };
  const recipientIds = taskAssigneeIds(access.task).filter((id) => id !== access.context.userId);
  await access.context.db.task.update({
    where: { id: taskId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      area: parsed.data.area || null,
      priority: parsed.data.priority,
      dueDate,
      activities: {
        create: {
          organizationId: access.context.organization.id,
          actorId: access.context.userId,
          action: "DETAILS_CHANGED",
          details: { recipientIds },
        },
      },
    },
  });
  revalidatePath("/aufgaben");
  return { success: "Aufgabendaten aktualisiert." };
}

export async function updateTaskAssignmentsAction(
  taskId: string,
  scope: TaskScope,
  assigneeIdsInput: string[],
  primaryAssigneeId: string | null
): Promise<ActionState> {
  const access = await loadTaskForAction(taskId, "EDIT");
  if (access.error || !access.task) return { error: access.error };
  const parsedScope = z.nativeEnum(TaskScope).safeParse(scope);
  if (!parsedScope.success) return { error: "Ungültige Aufgabenart." };
  const parsedAssigneeIds = z.array(z.string().min(1).max(200)).max(100).safeParse(assigneeIdsInput);
  if (!parsedAssigneeIds.success) return { error: "Die Bearbeiterliste ist ungültig." };
  const assigneeIds = [...new Set(parsedAssigneeIds.data)];
  const primaryId = primaryAssigneeId || assigneeIds[0];
  if (primaryId && !assigneeIds.includes(primaryId)) {
    return { error: "Die primär verantwortliche Person muss als Bearbeiter ausgewählt sein." };
  }
  const memberships = assigneeIds.length
    ? await access.context.db.membership.findMany({ where: { userId: { in: assigneeIds } }, select: { userId: true, organizationId: true } })
    : [];
  if (memberships.length !== assigneeIds.length) return { error: "Mindestens eine Person ist kein aktives Teammitglied." };
  const assignments = memberships.map((membership) => ({
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.userId === primaryId ? "PRIMARY" as const : "COLLABORATOR" as const,
  }));
  try {
    validateTaskAssignments({ organizationId: access.context.organization.id, scope: parsedScope.data, assignments });
  } catch (error) {
    return { error: error instanceof TaskAssignmentInvariantError ? error.message : "Zuweisung ist ungültig." };
  }
  const previousIds = taskAssigneeIds(access.task);
  const newRecipientIds = assigneeIds.filter((id) => !previousIds.includes(id));
  await access.context.db.task.update({
    where: { id: taskId },
    data: {
      scope: parsedScope.data,
      assigneeId: primaryId ?? null,
      assignments: {
        deleteMany: {},
        create: assignments.map((item) => ({ organizationId: access.context.organization.id, userId: item.userId, role: item.role })),
      },
      activities: {
        create: {
          organizationId: access.context.organization.id,
          actorId: access.context.userId,
          action: "ASSIGNED",
          details: { recipientIds: newRecipientIds, assigneeIds, primaryAssigneeId: primaryId ?? null },
        },
      },
    },
  });
  revalidatePath("/aufgaben");
  return { success: "Zuweisung aktualisiert." };
}

export async function archiveTaskAction(taskId: string, archived: boolean): Promise<ActionState> {
  const access = await loadTaskForAction(taskId, "ARCHIVE");
  if (access.error || !access.task) return { error: access.error };
  if (archived && access.task.status !== "DONE" && access.task.status !== "CANCELLED") return { error: "Nur erledigte oder abgebrochene Aufgaben können archiviert werden." };
  await access.context.db.task.update({
    where: { id: taskId },
    data: { archived, activities: { create: { organizationId: access.context.organization.id, actorId: access.context.userId, action: archived ? "ARCHIVED" : "RESTORED" } } },
  });
  revalidatePath("/aufgaben");
  return { success: archived ? "Aufgabe archiviert." : "Aufgabe wiederhergestellt." };
}

export async function snoozeTaskAction(taskId: string, until: string | null): Promise<ActionState> {
  const access = await loadTaskForAction(taskId, "EDIT");
  if (access.error || !access.task) return { error: access.error };
  const snoozedUntil = until ? new Date(until) : null;
  if (snoozedUntil && Number.isNaN(snoozedUntil.getTime())) return { error: "Ungültiges Wiedervorlagedatum." };
  await access.context.db.task.update({
    where: { id: taskId },
    data: { snoozedUntil, activities: { create: { organizationId: access.context.organization.id, actorId: access.context.userId, action: "SNOOZED", details: { until: snoozedUntil?.toISOString() ?? null } } } },
  });
  revalidatePath("/aufgaben");
  return { success: snoozedUntil ? "Wiedervorlage gesetzt." : "Wiedervorlage entfernt." };
}

export async function addTaskCommentAction(taskId: string, message: string): Promise<ActionState> {
  const access = await loadTaskForAction(taskId, "COMMENT");
  if (access.error || !access.task) return { error: access.error };
  const parsed = z.string().trim().min(1).max(2000).safeParse(message);
  if (!parsed.success) return { error: "Kommentar muss zwischen 1 und 2.000 Zeichen lang sein." };
  const recipientIds = taskAssigneeIds(access.task).filter((id) => id !== access.context.userId);
  await access.context.db.taskActivity.create({ data: { organizationId: access.context.organization.id, taskId, actorId: access.context.userId, action: "COMMENTED", details: { message: parsed.data, recipientIds } } });
  revalidatePath("/aufgaben");
  return { success: "Kommentar hinzugefügt." };
}

export async function addTaskChecklistItemAction(taskId: string, label: string): Promise<ActionState> {
  const access = await loadTaskForAction(taskId, "EDIT");
  if (access.error || !access.task) return { error: access.error };
  const parsed = z.string().trim().min(1).max(300).safeParse(label);
  if (!parsed.success) return { error: "Checklistenpunkt ist ungültig." };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${access.context.organization.id}, TRUE)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:task-checklist:${access.context.organization.id}:${taskId}`}))`;
    const last = await tx.taskChecklistItem.findFirst({ where: { organizationId: access.context.organization.id, taskId }, orderBy: { position: "desc" }, select: { position: true } });
    await tx.taskChecklistItem.create({ data: { organizationId: access.context.organization.id, taskId, label: parsed.data, position: (last?.position ?? -1) + 1 } });
    const checklist = await tx.taskChecklistItem.findMany({ where: { organizationId: access.context.organization.id, taskId }, select: { completed: true } });
    const progress = deriveTaskProgress({ status: access.task.status, checklist });
    await tx.task.update({ where: { id: taskId }, data: { progressPercent: progress.percent ?? 0 } });
  });
  revalidatePath("/aufgaben");
  return { success: "Checklistenpunkt hinzugefügt." };
}

export async function toggleTaskChecklistItemAction(itemId: string, completed: boolean): Promise<ActionState> {
  const context = await requireOrg();
  const item = await context.db.taskChecklistItem.findFirst({ where: { id: itemId }, include: { task: { include: { assignments: { select: { userId: true, role: true } } } } } });
  if (!item) return { error: "Checklistenpunkt nicht gefunden." };
  if (!canPerformTaskAction(permissionInput(item.task, context.userId, context.membership.role, "EDIT"))) return { error: taskPermissionMessage("EDIT") };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${context.organization.id}, TRUE)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storagex:task-checklist:${context.organization.id}:${item.taskId}`}))`;
    await tx.taskChecklistItem.update({ where: { id: itemId }, data: { completed, completedAt: completed ? new Date() : null, completedById: completed ? context.userId : null } });
    const checklist = await tx.taskChecklistItem.findMany({ where: { organizationId: context.organization.id, taskId: item.taskId }, select: { completed: true } });
    const progress = deriveTaskProgress({ status: item.task.status, checklist });
    await tx.task.update({ where: { id: item.taskId }, data: { progressPercent: progress.percent ?? 0, activities: { create: { organizationId: context.organization.id, actorId: context.userId, action: "CHECKLIST_CHANGED", details: { itemId, completed } } } } });
  });
  revalidatePath("/aufgaben");
  return { success: "Checkliste aktualisiert." };
}
