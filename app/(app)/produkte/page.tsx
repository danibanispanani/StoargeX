import { redirect } from "next/navigation";
import { resolveReadOrgContext } from "@/lib/org";
import { loadProductInitialRead } from "@/lib/products/product-read-loader";
import { PageHeader } from "@/components/app/page-header";
import { ProductDialog } from "@/components/products/product-dialog";
import { ProductFilterBar } from "@/components/products/product-filter-bar";
import { ProductTable } from "@/components/products/product-table";

type ProductSearchParams = Record<string, string | string[] | undefined>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductSearchParams>;
}) {
  const access = await resolveReadOrgContext();
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    throw new Error("Keine Berechtigung fuer diese Aktion.");
  }
  const { db, organizationId, userId } = access.context;
  const rawParams = await searchParams;
  const {
    rows,
    totalResults,
    query,
    queryString,
    allResultDigest,
    categories,
    brands,
    ebayCategories,
    kauflandCategories,
  } = await loadProductInitialRead({
    db,
    organizationId,
    params: rawParams,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Handel / Katalog"
        title="Produkte"
        description="Produktstammdaten, Kategorien und Kalkulationsgrundlagen verwalten."
        actions={<ProductDialog ebayCategories={ebayCategories} kauflandCategories={kauflandCategories} />}
      />

      <ProductFilterBar query={query} categories={categories} brands={brands} />

      <ProductTable
        rows={rows}
        totalResults={totalResults}
        query={query}
        queryString={queryString}
        allResultDigest={allResultDigest}
        categories={categories}
        ebayCategories={ebayCategories}
        kauflandCategories={kauflandCategories}
        scope={{
          organizationId,
          userId,
          tableKey: "products",
        }}
      />
    </div>
  );
}
