import { requireOrg } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { PageToolbar } from "@/components/app/page-toolbar";
import { DashboardFilter } from "@/components/dashboard/dashboard-filter";
import { InsightCockpit } from "@/components/dashboard/insight-cockpit";
import {
  parseInsightFilters,
  type InsightFilterInput,
} from "@/lib/dashboard/insight-dashboard";
import { loadInsightDashboard } from "@/lib/dashboard/load-insight-dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<InsightFilterInput>;
}) {
  const { db, organization } = await requireOrg();
  const requestedFilters = parseInsightFilters(await searchParams);
  const dashboard = await loadInsightDashboard(
    db,
    requestedFilters,
    organization.lowStockThreshold
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Operations & Performance"
        title={organization.name}
        description={
          <>
            Insight Cockpit · {dashboard.period.current.label} · Vergleich mit
            unmittelbar vorherigem Zeitraum
          </>
        }
      />

      <PageToolbar
        className="items-start px-3 py-2"
        primary={
          <DashboardFilter filters={dashboard.filters} options={dashboard.options} />
        }
      />

      <InsightCockpit
        snapshot={dashboard.snapshot}
        range={dashboard.period.current}
        dataBasis={dashboard.dataBasis}
      />
    </div>
  );
}
