import { describe, expect, it } from "vitest";
import { canPerformTaskAction } from "@/lib/services/task-permission-policy";

const personal = {
  actorId: "member-a", creatorId: "member-a", primaryAssigneeId: "member-a",
  assigneeIds: ["member-a"], scope: "PERSONAL" as const,
};

describe("task permission policy", () => {
  it("allows READONLY to read only", () => {
    for (const action of ["CREATE", "ASSIGN_OTHERS", "EDIT", "COMMENT", "ARCHIVE"] as const) {
      expect(canPerformTaskAction({ ...personal, role: "READONLY", action })).toBe(false);
    }
    expect(canPerformTaskAction({ ...personal, role: "READONLY", action: "READ" })).toBe(true);
  });

  it("allows MEMBER to create and assign within the team", () => {
    expect(canPerformTaskAction({ ...personal, role: "MEMBER", action: "CREATE" })).toBe(true);
    expect(canPerformTaskAction({ ...personal, role: "MEMBER", action: "ASSIGN_OTHERS" })).toBe(true);
  });

  it("limits MEMBER editing and archiving to participants", () => {
    expect(canPerformTaskAction({ ...personal, role: "MEMBER", action: "EDIT" })).toBe(true);
    expect(canPerformTaskAction({ ...personal, role: "MEMBER", action: "ARCHIVE" })).toBe(true);
    expect(canPerformTaskAction({ ...personal, actorId: "member-b", role: "MEMBER", action: "EDIT" })).toBe(false);
  });

  it("allows members to comment on team tasks but only participants to edit", () => {
    const team = { ...personal, scope: "TEAM" as const, actorId: "member-b" };
    expect(canPerformTaskAction({ ...team, role: "MEMBER", action: "COMMENT" })).toBe(true);
    expect(canPerformTaskAction({ ...team, role: "MEMBER", action: "EDIT" })).toBe(false);
  });

  it("allows ADMIN and OWNER to manage every task", () => {
    for (const role of ["ADMIN", "OWNER"] as const) {
      expect(canPerformTaskAction({ ...personal, actorId: "manager", role, action: "ARCHIVE" })).toBe(true);
    }
  });

  it("keeps unassigned legacy team tasks editable for members", () => {
    expect(canPerformTaskAction({
      role: "MEMBER",
      action: "EDIT",
      actorId: "member-b",
      creatorId: "member-a",
      scope: null,
      assigneeIds: [],
    })).toBe(true);
  });
});
