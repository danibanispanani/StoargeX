import Link from "next/link";
import type { ActivityEntry } from "@/lib/activity";
import { ActivityFilter } from "@/components/reports/activity-filter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** "Letzte Aktivitäten" – nur für OWNER/ADMIN auf dem Dashboard. */
export function ActivityWidget({
  entries,
  members,
  currentMember,
  currentAction,
}: {
  entries: ActivityEntry[];
  members: Array<{ userId: string; name: string }>;
  currentMember: string;
  currentAction: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>Letzte Aktivitäten</CardTitle>
          <CardDescription>Die letzten {entries.length} Aktionen im Team</CardDescription>
        </div>
        <ActivityFilter
          members={members}
          currentMember={currentMember}
          currentAction={currentAction}
        />
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Keine Aktivitäten für diesen Filter.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <strong>{entry.actorName}</strong>{" "}
                  {entry.href ? (
                    <Link href={entry.href} className="underline-offset-2 hover:underline">
                      {entry.text}
                    </Link>
                  ) : (
                    entry.text
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.createdAt.toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
