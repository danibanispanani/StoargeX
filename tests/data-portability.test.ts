import { describe, expect, it } from "vitest";
import {
  EXPORT_DATASET_KEYS,
  GDPR_REQUIRED_DATASETS,
  IMPORT_CENTER_MODULES,
  sanitizePortableData,
  selectExportColumns,
} from "@/lib/data-portability/catalog";

describe("data portability catalog", () => {
  it("registers every Prompt-10 import module on the established table keys", () => {
    expect(IMPORT_CENTER_MODULES.map((module) => module.table)).toEqual([
      "produkte",
      "einkauf",
      "lager",
      "verkauf",
      "kundenretouren",
      "lieferantenretouren",
      "konsignation",
      "schulden",
      "aufgaben",
      "ausgaben",
      "gebuehrenregeln",
    ]);
  });

  it("exposes all requested relational export datasets", () => {
    expect(EXPORT_DATASET_KEYS).toEqual([
      "inventory-ledger",
      "purchases",
      "sale-lines",
      "return-lines",
      "supplier-returns",
      "expenses",
      "fee-rules",
      "tasks",
      "platform-accounts",
      "entitlements",
    ]);
  });

  it("declares the complete GDPR core coverage", () => {
    expect(GDPR_REQUIRED_DATASETS).toEqual(expect.arrayContaining([
      "products",
      "purchases",
      "purchaseLines",
      "inventoryPositions",
      "ownedStockLots",
      "consignmentLots",
      "inventoryMovements",
      "saleLines",
      "saleLineAllocations",
      "returnLines",
      "returnAllocations",
      "supplierReturns",
      "supplierReturnLines",
      "debtPurchaseLinks",
      "debtSaleLinks",
      "debtInventoryLinks",
      "importBatches",
      "sourceReferences",
      "expenses",
      "businessPartners",
      "marketplaceAccounts",
      "inventoryPositionListings",
      "legacySaleItems",
    ]));
  });

  it("removes secrets recursively without dropping portable business metadata", () => {
    const result = sanitizePortableData({
      email: "person@example.test",
      passwordHash: "hash",
      token: "invite-token",
      nested: {
        secretEncrypted: "ciphertext",
        recoveryCodes: ["hash"],
        metadata: {
          apiToken: "secret",
          apiKey: "key",
          passwort: "pw",
          externalOrderId: "ORDER-1",
        },
      },
    });

    expect(result).toEqual({
      email: "person@example.test",
      nested: {
        metadata: { externalOrderId: "ORDER-1" },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /ciphertext|invite-token|apiToken|apiKey|passwort|passwordHash/
    );
  });

  it("keeps only explicitly selected export columns in source order", () => {
    expect(selectExportColumns(
      [{ Name: "Produkt", EAN: "123", Kategorie: "Elektronik" }],
      ["Kategorie", "Name", "Nicht vorhanden"]
    )).toEqual([{ Kategorie: "Elektronik", Name: "Produkt" }]);
  });
});
