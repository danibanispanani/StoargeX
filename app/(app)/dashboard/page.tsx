import { requireOrg } from "@/lib/org";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const { db, organization } = await requireOrg();

  const [stockCount, salesCount, openTasks, memberCount] = await Promise.all([
    db.stockItem.count({ where: { status: { in: ["IN_STOCK", "LISTED"] } } }),
    db.sale.count(),
    db.task.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.membership.count(),
  ]);

  const stats = [
    { label: "Artikel im Bestand", value: stockCount },
    { label: "Verkäufe gesamt", value: salesCount },
    { label: "Offene Aufgaben", value: openTasks },
    { label: "Teammitglieder", value: memberCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{organization.name}</h1>
        <p className="text-sm text-muted-foreground">
          Überblick über deine Organisation
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Die Module Lager, Verkäufe, Retouren, Kommission, Schulden und Aufgaben
        bauen auf diesem Fundament auf – Datenmodell und Mandantentrennung
        stehen bereits.
      </p>
    </div>
  );
}
