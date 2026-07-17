import type { Prisma } from "@prisma/client";

export const SALE_PAGE_SIZES = [25, 50, 100] as const;

export function parseSalePagination(params: {
  page?: string;
  pageSize?: string;
}) {
  const requestedPage = positiveInteger(params.page);
  const requestedPageSize = positiveInteger(params.pageSize);

  return {
    page: requestedPage || 1,
    pageSize: SALE_PAGE_SIZES.includes(
      requestedPageSize as (typeof SALE_PAGE_SIZES)[number]
    )
      ? requestedPageSize
      : 50,
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
