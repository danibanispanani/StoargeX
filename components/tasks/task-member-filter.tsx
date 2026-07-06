"use client";

import { useRouter } from "next/navigation";

/** OWNER/ADMIN: Aufgaben nach Zuständigem filtern. */
export function TaskMemberFilter({
  members,
  current,
  showArchived,
}: {
  members: Array<{ userId: string; name: string }>;
  current: string;
  showArchived: boolean;
}) {
  const router = useRouter();

  return (
    <select
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams();
        if (showArchived) params.set("archiv", "1");
        if (e.target.value) params.set("zustaendig", e.target.value);
        router.push(`/aufgaben${params.size ? `?${params}` : ""}`);
      }}
      className="border-input h-9 rounded-md border bg-background px-2 text-sm"
    >
      <option value="">Zuständig: alle Mitglieder</option>
      <option value="alle">Zuständig: „Alle&ldquo;-Aufgaben</option>
      {members.map((member) => (
        <option key={member.userId} value={member.userId}>
          Zuständig: {member.name}
        </option>
      ))}
    </select>
  );
}
