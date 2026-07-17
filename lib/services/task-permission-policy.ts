import type { Role, TaskScope } from "@prisma/client";

export type TaskAction =
  | "READ"
  | "CREATE"
  | "ASSIGN_OTHERS"
  | "EDIT"
  | "COMMENT"
  | "ARCHIVE";

export interface TaskPermissionInput {
  role: Role;
  action: TaskAction;
  actorId: string;
  creatorId?: string;
  primaryAssigneeId?: string | null;
  assigneeIds?: readonly string[];
  scope?: TaskScope | null;
}

/** Central server-side policy used by every task mutation. */
export function canPerformTaskAction(input: TaskPermissionInput): boolean {
  if (input.action === "READ") return true;
  if (input.role === "READONLY") return false;
  if (input.role === "ADMIN" || input.role === "OWNER") return true;
  if (input.action === "CREATE" || input.action === "ASSIGN_OTHERS") return true;

  const isCreator = input.creatorId === input.actorId;
  const isAssignee = input.assigneeIds?.includes(input.actorId) ?? false;
  const isPrimary = input.primaryAssigneeId === input.actorId;
  const isLegacyShared = input.scope == null && (input.assigneeIds?.length ?? 0) === 0;

  if (input.action === "COMMENT") {
    return input.scope === "TEAM" || isLegacyShared || isCreator || isAssignee;
  }
  if (input.action === "ARCHIVE") return isLegacyShared || isCreator || isPrimary;
  return isLegacyShared || isCreator || isAssignee;
}

export function taskPermissionMessage(action: TaskAction): string {
  const labels: Record<TaskAction, string> = {
    READ: "ansehen",
    CREATE: "anlegen",
    ASSIGN_OTHERS: "zuweisen",
    EDIT: "aendern",
    COMMENT: "kommentieren",
    ARCHIVE: "archivieren",
  };
  return `Du darfst diese Aufgabe nicht ${labels[action]}.`;
}
