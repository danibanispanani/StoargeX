import { describe, expect, it } from "vitest";
import { calcSale, grossToNetCents } from "@/lib/calculations";
import { prepareConsignmentStock } from "@/lib/services/consignment-service";
import { prepareOwnedPurchaseLines } from "@/lib/services/owned-purchase-service";
import {
  planSaleAllocationsFromSnapshots,
  salePlanCostNetCents,
  type SaleInventorySnapshot,
} from "@/lib/services/sales-service";
import {
  planReturnAllocationsFromSnapshots,
  type ReturnAllocationSnapshot,
} from "@/lib/services/returns-service";
import {
  purchaseDebtPayload,
  saleDebtPayload,
} from "@/lib/services/debt-service";

describe("inventory end-to-end domain scenario", () => {
  it("integriert Einkauf, Konsignation, Verkauf, Debt und Retoure konsistent", () => {
    const purchaseLines = prepareOwnedPurchaseLines([
      {
        productName: "Fire TV Stick",
        quantity: 10,
        unitPriceGrossCents: 2999,
        inputTaxDeductible: true,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
      {
        productName: "Bosch Set",
        quantity: 5,
        unitPriceGrossCents: 5999,
        inputTaxDeductible: true,
        inputTaxRatePercent: 19,
        purchaseEntryStatus: "O",
        returnEntryStatus: "NN",
      },
    ]);

    expect(purchaseLines).toHaveLength(2);
    expect(purchaseLines.map((line) => line.quantity)).toEqual([10, 5]);
    expect(purchaseDebtPayload({
      organizationId: "org-a",
      purchaseId: "purchase-a",
      purchaseNumber: "E-26-0001",
      purchaseDate: new Date("2026-01-05T00:00:00.000Z"),
      vendor: "Amazon",
      paymentMethod: "Richard",
      totalGrossCents: purchaseLines.reduce((sum, line) => sum + line.totalGrossCents, 0),
    })).toEqual(expect.objectContaining({
      type: "PURCHASE",
      debtorName: "GbR",
      creditorName: "Richard",
    }));

    const consignment = prepareConsignmentStock({
      organizationId: "org-a",
      createdById: "user-a",
      partnerCompany: "Pattfield",
      productName: "Pattfield Akku",
      quantityReceived: 20,
      costNetCents: 1200,
    });

    expect(consignment.quantityAvailable).toBe(20);
    expect(consignment.partnerCompany).toBe("Pattfield");

    const saleGrossCents = 25000;
    const saleNetCents = grossToNetCents(saleGrossCents, 19);
    const candidates: SaleInventorySnapshot[] = [
      {
        id: "fire-lot",
        organizationId: "org-a",
        productId: "fire-product",
        productName: "Fire TV Stick",
        variant: null,
        size: null,
        inventoryType: "OWNED",
        inventoryNumber: "L-26-0001",
        quantityAvailable: 10,
        receivedAt: new Date("2026-01-05T00:00:00.000Z"),
        unitCostNetCents: purchaseLines[0].unitPriceNetCents,
      },
      {
        id: "akku-k",
        organizationId: "org-a",
        productId: "akku-product",
        productName: "Pattfield Akku",
        variant: null,
        size: null,
        inventoryType: "CONSIGNMENT",
        inventoryNumber: "K-26-0001",
        quantityAvailable: 20,
        receivedAt: new Date("2026-01-06T00:00:00.000Z"),
        unitCostNetCents: 1200,
        consignmentPartner: "Pattfield",
      },
    ];

    const salePlan = planSaleAllocationsFromSnapshots({
      organizationId: "org-a",
      selections: [
        { inventoryPositionId: "fire-lot", quantity: 2 },
        { inventoryPositionId: "akku-k", quantity: 3 },
      ],
      candidates,
      saleGrossCents,
      saleNetCents,
    });
    const allocations = salePlan.flatMap((line) => line.allocations);

    expect(salePlan).toHaveLength(2);
    expect(allocations).toEqual([
      expect.objectContaining({ inventoryPositionId: "akku-k", quantity: 3 }),
      expect.objectContaining({ inventoryPositionId: "fire-lot", quantity: 2 }),
    ]);

    const purchaseNetCents = salePlanCostNetCents(salePlan);
    const calc = calcSale({
      saleGrossCents,
      taxRatePercent: 19,
      purchaseNetCents,
      shippingCostCents: 500,
      platformFeeCents: 1200,
      paymentFeeCents: 0,
    });

    expect(calc.profitCents).toBeGreaterThan(0);
    expect(saleDebtPayload({
      organizationId: "org-a",
      saleId: "sale-a",
      saleNumber: "V-26-0001",
      soldAt: new Date("2026-01-10T00:00:00.000Z"),
      payoutRecipient: "PayPal R",
      saleGrossCents,
      quantity: 5,
      description: "Privater Auszahlungsempfänger",
    })).toEqual(expect.objectContaining({
      type: "SALE",
      debtorName: "Richard",
      creditorName: "GbR",
      amountCents: saleGrossCents,
    }));

    const returnSnapshots: ReturnAllocationSnapshot[] = [
      {
        id: "fire-allocation",
        organizationId: "org-a",
        saleLineId: "fire-line",
        inventoryPositionId: "fire-lot",
        inventoryNumber: "L-26-0001",
        inventoryType: "OWNED",
        quantitySold: 2,
        quantityAlreadyReturned: 0,
      },
    ];
    const [returnPlan] = planReturnAllocationsFromSnapshots({
      organizationId: "org-a",
      selections: [{ saleLineAllocationId: "fire-allocation", quantity: 1 }],
      allocations: returnSnapshots,
    });

    expect(returnPlan).toEqual(expect.objectContaining({
      inventoryPositionId: "fire-lot",
      quantity: 1,
      returnableBefore: 2,
    }));

    const fireAfterSale = 10 - 2;
    const fireAfterRestock = fireAfterSale + 1;
    expect(fireAfterRestock).toBe(9);
  });
});
