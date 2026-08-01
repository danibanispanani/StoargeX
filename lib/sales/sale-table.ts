import type { Prisma } from "@prisma/client";
import { parseTablePageSize } from "@/lib/operational-table";

export function parseSalePagination(params: {
  page?: string;
  pageSize?: string;
}) {
  const requestedPage = positiveInteger(params.page);
  return {
    page: requestedPage || 1,
    pageSize: parseTablePageSize(params.pageSize),
  };
}

export function buildSaleViewWhere(view: string): Prisma.SaleWhereInput {
  if (view === "standard") {
    return {
      OR: [
        { invoiceCreated: false },
        { status: { in: ["PENDING", "PAID", "SHIPPED"] } },
      ],
    };
  }
  if (view === "shipping") {
    return {
      OR: [
        { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        { shippingMethod: { not: null } },
      ],
    };
  }
  if (view === "payout") {
    return {
      OR: [
        { payoutRecipient: { not: null } },
        { debtLinks: { some: {} } },
      ],
    };
  }
  return {};
}

function positiveInteger(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
