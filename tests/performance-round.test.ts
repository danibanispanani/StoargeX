import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("erste Performance-Runde", () => {
  it("laedt grosse Formularoptionen nicht mehr mit den Haupttabellen", () => {
    const stockPage = source("app/(app)/lager/page.tsx");
    const purchasePage = source("app/(app)/einkauf/page.tsx");
    const salesPage = source("app/(app)/verkauf/page.tsx");

    expect(stockPage).toContain("LazyStockItemDialog");
    expect(stockPage).not.toContain("db.product.findMany");
    expect(purchasePage).toContain("LazyPurchaseOrderDialog");
    expect(purchasePage).not.toContain("db.product.findMany");
    expect(salesPage).toContain("LazyCreateSaleDialog");
    expect(salesPage).not.toContain("db.inventoryPosition.findMany");
    expect(salesPage).not.toContain("getFeatureAccess");
  });

  it("loest verzoegert geladene Optionen tenant- und rollensicher auf", () => {
    const stockActions = source("lib/actions/stock.ts");
    const purchaseActions = source("lib/actions/purchases.ts");
    const salesActions = source("lib/actions/sales.ts");

    expect(stockActions).toMatch(
      /loadStockReceiptProductOptionsAction[\s\S]*requireOrg\("MEMBER", trace\)/
    );
    expect(purchaseActions).toMatch(
      /loadPurchaseProductOptionsAction[\s\S]*requireOrg\("MEMBER"\)/
    );
    expect(salesActions).toMatch(
      /loadSellableSaleItemsAction[\s\S]*requireOrg\("MEMBER"\)/
    );
    expect(salesActions).toMatch(
      /loadSellableSaleItemsAction[\s\S]*getFeatureAccess\([\s\S]*FEATURE_KEYS\.CONSIGNMENT/
    );
  });

  it("laedt Verkaufsformularoptionen erst beim Oeffnen des Dialogs", () => {
    const salesPage = source("app/(app)/verkauf/page.tsx");
    const salesActions = source("lib/actions/sales.ts");
    const createDialog = source("components/sales/lazy-create-sale-dialog.tsx");
    const editDialog = source("components/sales/lazy-sale-dialog.tsx");

    expect(salesPage).toContain("loadSalesInitialRead");
    expect(salesPage).not.toContain("marketplaceAccount.findMany");
    expect(salesPage).not.toContain("getOptions(db");
    expect(salesActions).toContain("loadSaleDialogOptionsAction");
    expect(salesActions).toMatch(
      /loadSaleDialogOptionsAction[\s\S]*requireOrg\("MEMBER"\)/
    );
    expect(createDialog).toContain("loadSaleDialogOptionsAction({ includeItems: true })");
    expect(editDialog).toContain("loadSaleDialogOptionsAction()");
  });

  it("verwendet die request-lokal gecachte Sitzung in Layout und Org-Aufloesung", () => {
    const org = source("lib/org.ts");
    const layout = source("app/(app)/layout.tsx");
    expect(org).toContain("export const getRequestSession = cache(auth)");
    expect(org).toContain("const session = await getRequestSession()");
    expect(layout).toContain("getRequestSession()");
    expect(layout).not.toContain('from "@/auth"');
  });

  it("besitzt layoutnahe Ladezustaende fuer alle fuenf Haupttabs", () => {
    for (const tab of ["dashboard", "lager", "einkauf", "verkauf", "produkte"]) {
      expect(source(`app/(app)/${tab}/loading.tsx`)).toContain(
        "OperationalPageLoading"
      );
    }
  });

  it("loest Produktaktionen nicht zusaetzlich per router.refresh aus", () => {
    const table = source("components/products/product-table.tsx");
    expect(table).not.toContain("router.refresh()");
    expect(table).not.toContain("useRouter");
    expect(source("lib/actions/products.ts")).toContain(
      'revalidatePath("/produkte")'
    );
    expect(source("lib/actions/marketplace-pricing.ts")).toContain(
      'revalidatePath("/produkte")'
    );
  });
});
