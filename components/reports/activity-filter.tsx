"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ACTIVITY_GROUPS } from "@/lib/activity";

/** Filter des Aktivitäts-Widgets: Mitglied + Aktionstyp (Query-Parameter). */
export function ActivityFilter({
  members,
  currentMember,
  currentAction,
}: {
  members: Array<{ userId: string; name: string }>;
  currentMember: string;
  currentAction: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(member: string, action: string) {
    const params = new URLSearchParams(searchParams);
    if (member) params.set("akteur", member);
    else params.delete("akteur");
    if (action) params.set("aktion", action);
    else params.delete("aktion");
    router.push(`/dashboard${params.size ? `?${params}` : ""}`);
  }

  const selectClass =
    "border-input h-8 rounded-md border bg-background px-2 text-xs";

  return (
    <div className="flex gap-1.5">
      <select
        value={currentMember}
        onChange={(e) => navigate(e.target.value, currentAction)}
        className={selectClass}
        aria-label="Nach Mitglied filtern"
      >
        <option value="">Alle Mitglieder</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </select>
      <select
        value={currentAction}
        onChange={(e) => navigate(currentMember, e.target.value)}
        className={selectClass}
        aria-label="Nach Aktionstyp filtern"
      >
        <option value="">Alle Aktionen</option>
        {ACTIVITY_GROUPS.map((group) => (
          <option key={group.prefix} value={group.prefix}>
            {group.label}
          </option>
        ))}
      </select>
    </div>
  );
}
