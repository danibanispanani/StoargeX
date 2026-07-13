import { describe, expect, it } from "vitest";
import {
  TaskAssignmentInvariantError,
  validateTaskAssignments,
} from "@/lib/services/task-assignment-service";

const primary = { organizationId: "org-1", userId: "user-1", role: "PRIMARY" as const };
const collaborator = {
  organizationId: "org-1",
  userId: "user-2",
  role: "COLLABORATOR" as const,
};

describe("task assignment invariants", () => {
  it("akzeptiert persönliche und Teamaufgaben mit genau einem Primary", () => {
    expect(() =>
      validateTaskAssignments({ organizationId: "org-1", scope: "PERSONAL", assignments: [primary] })
    ).not.toThrow();
    expect(() =>
      validateTaskAssignments({
        organizationId: "org-1",
        scope: "TEAM",
        assignments: [primary, collaborator],
      })
    ).not.toThrow();
  });

  it("verhindert Tenant-Überschreitungen", () => {
    expect(() =>
      validateTaskAssignments({
        organizationId: "org-1",
        scope: "PERSONAL",
        assignments: [{ ...primary, organizationId: "org-2" }],
      })
    ).toThrowError(expect.objectContaining({ code: "CROSS_TENANT_ASSIGNMENT" }));
  });

  it("verhindert doppelte Benutzer und mehrere Primärverantwortliche", () => {
    expect(() =>
      validateTaskAssignments({
        organizationId: "org-1",
        scope: "TEAM",
        assignments: [primary, { ...primary, role: "COLLABORATOR" }],
      })
    ).toThrowError(TaskAssignmentInvariantError);
    expect(() =>
      validateTaskAssignments({
        organizationId: "org-1",
        scope: "TEAM",
        assignments: [primary, { ...collaborator, role: "PRIMARY" }],
      })
    ).toThrowError(expect.objectContaining({ code: "MULTIPLE_PRIMARY_ASSIGNEES" }));
  });

  it("erfordert bei zugewiesenen Teamaufgaben einen Primary", () => {
    expect(() =>
      validateTaskAssignments({
        organizationId: "org-1",
        scope: "TEAM",
        assignments: [collaborator],
      })
    ).toThrowError(expect.objectContaining({ code: "TEAM_PRIMARY_REQUIRED" }));
  });

  it("lässt Legacyaufgaben ohne Scope weiterhin lesbar", () => {
    expect(() =>
      validateTaskAssignments({
        organizationId: "org-1",
        scope: null,
        assignments: [collaborator],
      })
    ).not.toThrow();
  });
});
