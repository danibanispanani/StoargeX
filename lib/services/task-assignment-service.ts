export type TaskScope = "PERSONAL" | "TEAM";
export type TaskAssignmentRole = "PRIMARY" | "COLLABORATOR";

export interface TaskAssignmentCandidate {
  organizationId: string;
  userId: string;
  role: TaskAssignmentRole;
}

export type TaskAssignmentInvariantCode =
  | "CROSS_TENANT_ASSIGNMENT"
  | "DUPLICATE_ASSIGNEE"
  | "MULTIPLE_PRIMARY_ASSIGNEES"
  | "INVALID_PERSONAL_ASSIGNMENT"
  | "TEAM_PRIMARY_REQUIRED";

export class TaskAssignmentInvariantError extends Error {
  constructor(
    public readonly code: TaskAssignmentInvariantCode,
    message: string
  ) {
    super(message);
    this.name = "TaskAssignmentInvariantError";
  }
}

export function validateTaskAssignments(input: {
  organizationId: string;
  scope: TaskScope | null;
  assignments: readonly TaskAssignmentCandidate[];
}): void {
  if (input.assignments.some((item) => item.organizationId !== input.organizationId)) {
    throw new TaskAssignmentInvariantError(
      "CROSS_TENANT_ASSIGNMENT",
      "Aufgaben dürfen nur Benutzer derselben Organisation zuweisen."
    );
  }

  const uniqueUsers = new Set(input.assignments.map((item) => item.userId));
  if (uniqueUsers.size !== input.assignments.length) {
    throw new TaskAssignmentInvariantError(
      "DUPLICATE_ASSIGNEE",
      "Ein Benutzer darf einer Aufgabe nur einmal zugewiesen sein."
    );
  }

  const primaryCount = input.assignments.filter((item) => item.role === "PRIMARY").length;
  if (primaryCount > 1) {
    throw new TaskAssignmentInvariantError(
      "MULTIPLE_PRIMARY_ASSIGNEES",
      "Eine Aufgabe darf höchstens eine primär verantwortliche Person haben."
    );
  }

  // Null keeps legacy tasks readable until their scope is explicitly classified.
  if (input.scope === null) return;

  if (
    input.scope === "PERSONAL" &&
    (input.assignments.length !== 1 || primaryCount !== 1)
  ) {
    throw new TaskAssignmentInvariantError(
      "INVALID_PERSONAL_ASSIGNMENT",
      "Eine persönliche Aufgabe benötigt genau eine primär verantwortliche Person."
    );
  }

  if (input.scope === "TEAM" && input.assignments.length > 0 && primaryCount !== 1) {
    throw new TaskAssignmentInvariantError(
      "TEAM_PRIMARY_REQUIRED",
      "Eine zugewiesene Teamaufgabe benötigt genau eine primär verantwortliche Person."
    );
  }
}
