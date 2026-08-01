"use client";

import { useTransition } from "react";
import { UserMinusIcon } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/lib/actions/team";
import { ActionIconButton } from "@/components/ui/action-icon-button";

export function MemberActions({
  membershipId,
  currentRole,
  actorIsOwner,
}: {
  membershipId: string;
  currentRole: Role;
  actorIsOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function changeRole(role: Role) {
    startTransition(async () => {
      const result = await updateMemberRoleAction(membershipId, role);
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  function remove() {
    if (!confirm("Dieses Mitglied wirklich entfernen?")) return;
    startTransition(async () => {
      const result = await removeMemberAction(membershipId);
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentRole}
        disabled={pending || (!actorIsOwner && currentRole === "OWNER")}
        onChange={(e) => changeRole(e.target.value as Role)}
        className="border-input h-8 rounded-md border bg-transparent px-2 text-xs"
      >
        {actorIsOwner && <option value="OWNER">Inhaber</option>}
        {!actorIsOwner && currentRole === "OWNER" && (
          <option value="OWNER">Inhaber</option>
        )}
        <option value="ADMIN">Administrator</option>
        <option value="MEMBER">Mitglied</option>
        <option value="READONLY">Nur Lesen</option>
      </select>
      <ActionIconButton
        label="Mitglied entfernen"
        icon={UserMinusIcon}
        className="text-destructive"
        disabled={pending || (!actorIsOwner && currentRole === "OWNER")}
        onClick={remove}
      />
    </div>
  );
}
