import { redirect } from "next/navigation";
import { resolveReadOrgContext } from "@/lib/org";
import { PageHeader } from "@/components/app/page-header";
import { LazyPurchaseOrderDialog } from "@/components/purchases/lazy-purchase-order-dialog";
import { PurchaseFilterBar } from "@/components/purchases/purchase-filter-bar";
import { PurchaseTable } from "@/components/purchases/purchase-table";
import { loadPurchaseInitialRead } from "@/lib/purchases/purchase-read-loader";
import { purchaseQueryToSearchParams } from "@/lib/purchases/purchase-table";

type Params = Record<string, string | string[] | undefined>;

export default async function PurchasingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const access = await resolveReadOrgContext();
  if (!access.ok) redirect(access.status === 401 ? "/login" : "/dashboard");
  const { db, organizationId, userId } = access.context;
  const {
    rows,
    suppliers,
    paymentMethods,
    totalResults,
    query,
  } = await loadPurchaseInitialRead({
    db,
    organizationId,
    params: await searchParams,
  });

  return <div className="space-y-4">
    <PageHeader
      eyebrow="Handel / Beschaffung"
      title="Einkauf"
      description="Bestellungen vom Einkauf über den Versand bis zum Wareneingang steuern."
      actions={<LazyPurchaseOrderDialog suppliers={suppliers} paymentMethods={paymentMethods} />}
    />
    <PurchaseFilterBar query={query} suppliers={suppliers} />
    <PurchaseTable
      rows={rows}
      totalResults={totalResults}
      query={query}
      queryString={purchaseQueryToSearchParams(query).toString()}
      scope={{ organizationId, userId, tableKey: "purchases" }}
      nowIso={new Date().toISOString()}
      suppliers={suppliers}
      paymentMethods={paymentMethods}
    />
  </div>;
}
