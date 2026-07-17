import type { TaskDomainLinkType, TaskStatus } from "@prisma/client";

export interface DerivedTaskProgress {
  mode: "CHECKLIST" | "STATUS";
  completed: number;
  total: number;
  percent: number | null;
}

export function deriveTaskProgress(input: {
  status: TaskStatus;
  checklist: readonly { completed: boolean }[];
}): DerivedTaskProgress {
  if (input.checklist.length > 0) {
    const completed = input.checklist.filter((item) => item.completed).length;
    return {
      mode: "CHECKLIST",
      completed,
      total: input.checklist.length,
      percent: Math.round((completed / input.checklist.length) * 100),
    };
  }
  return {
    mode: "STATUS",
    completed: 0,
    total: 0,
    percent: input.status === "DONE" ? 100 : null,
  };
}

export interface TaskAttentionItem {
  taskId: string;
  title: string;
  kind: "DUE_SOON" | "OVERDUE";
  dueDate: Date;
}

export function taskAttentionItems(
  tasks: readonly {
    id: string;
    title: string;
    dueDate: Date | null;
    status: TaskStatus;
    archived: boolean;
    snoozedUntil?: Date | null;
  }[],
  now = new Date(),
  dueSoonHours = 48
): TaskAttentionItem[] {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dueSoonExclusive = new Date(todayStart);
  dueSoonExclusive.setDate(dueSoonExclusive.getDate() + Math.max(1, Math.ceil(dueSoonHours / 24)));
  return tasks
    .flatMap((task): TaskAttentionItem[] => {
      if (
        !task.dueDate
        || task.archived
        || task.status === "DONE"
        || task.status === "CANCELLED"
        || (task.snoozedUntil && task.snoozedUntil > now)
      ) return [];
      if (task.dueDate < todayStart) {
        return [{ taskId: task.id, title: task.title, kind: "OVERDUE", dueDate: task.dueDate }];
      }
      if (task.dueDate < dueSoonExclusive) {
        return [{ taskId: task.id, title: task.title, kind: "DUE_SOON", dueDate: task.dueDate }];
      }
      return [];
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export interface TaskDomainTarget {
  type: TaskDomainLinkType;
  id: string;
  organizationId: string;
}

export function validateTaskDomainLink(input: {
  organizationId: string;
  type: TaskDomainLinkType;
  targets: readonly TaskDomainTarget[];
}): TaskDomainTarget {
  if (input.targets.length !== 1) {
    throw new Error("Eine Fachobjektverknuepfung benoetigt genau ein Ziel.");
  }
  const target = input.targets[0];
  if (target.organizationId !== input.organizationId) {
    throw new Error("Das Fachobjekt gehoert nicht zu dieser Organisation.");
  }
  if (target.type !== input.type) {
    throw new Error("Der Fachobjekttyp passt nicht zum Ziel.");
  }
  return target;
}

export function taskDomainLinkData(type: TaskDomainLinkType, id: string) {
  return {
    purchaseId: type === "PURCHASE" ? id : null,
    inventoryPositionId: type === "INVENTORY_POSITION" ? id : null,
    saleId: type === "SALE" ? id : null,
    customerReturnId: type === "CUSTOMER_RETURN" ? id : null,
    supplierReturnId: type === "SUPPLIER_RETURN" ? id : null,
    debtId: type === "DEBT" ? id : null,
  };
}
