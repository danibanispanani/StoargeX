import { describe, expect, it } from "vitest";
import {
  buildSaleViewWhere,
  parseSalePagination,
} from "@/lib/sales/sale-table";

describe("sale table query configuration", () => {
  it("parses safe pagination boundaries", () => {
    expect(parseSalePagination({})).toEqual({ page: 1, pageSize: 100 });
    expect(parseSalePagination({ page: "2", pageSize: "200" })).toEqual({
      page: 2,
      pageSize: 200,
    });
    expect(parseSalePagination({ page: "-1", pageSize: "500" })).toEqual({
      page: 1,
      pageSize: 500,
    });
  });

  it("maps every operational view to its server-side result filter", () => {
    expect(buildSaleViewWhere("standard")).toEqual({
      OR: [
        { invoiceCreated: false },
        { status: { in: ["PENDING", "PAID", "SHIPPED"] } },
      ],
    });
    expect(buildSaleViewWhere("shipping")).toEqual({
      OR: [
        { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        { shippingMethod: { not: null } },
      ],
    });
    expect(buildSaleViewWhere("payout")).toEqual({
      OR: [
        { payoutRecipient: { not: null } },
        { debtLinks: { some: {} } },
      ],
    });
    expect(buildSaleViewWhere("finances")).toEqual({});
    expect(buildSaleViewWhere("all")).toEqual({});
  });
});
