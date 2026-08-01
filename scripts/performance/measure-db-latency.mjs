import { performance } from "node:perf_hooks";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const repeatCount = Math.max(3, Number.parseInt(process.env.PERFORMANCE_REPEAT ?? "5", 10));
const prisma = new PrismaClient();

function tenantDb(organizationId) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

async function measure(operation) {
  const startedAt = performance.now();
  const result = await operation();
  return { durationMs: performance.now() - startedAt, result };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function rounded(value) {
  return Math.round(value * 10) / 10;
}

function countMatches(value, pattern) {
  return value.match(pattern)?.length ?? 0;
}

function loadStructuralMetrics() {
  const stockPage = readFileSync("app/(app)/lager/page.tsx", "utf8");
  const purchasePage = readFileSync("app/(app)/einkauf/page.tsx", "utf8");
  const salesPage = readFileSync("app/(app)/verkauf/page.tsx", "utf8");
  const productTable = readFileSync("components/products/product-table.tsx", "utf8");
  return {
    initialFormOptionQueries: [
      stockPage.includes("db.product.findMany"),
      purchasePage.includes("db.product.findMany"),
      salesPage.includes("db.inventoryPosition.findMany"),
    ].filter(Boolean).length,
    mainTabLoadingStates: ["dashboard", "lager", "einkauf", "verkauf", "produkte"]
      .filter((tab) => existsSync(`app/(app)/${tab}/loading.tsx`)).length,
    productRouterRefreshes: countMatches(productTable, /router\.refresh\(\)/g),
  };
}

async function main() {
  const structuralMetrics = loadStructuralMetrics();
  if (process.argv.includes("--static-only")) {
    console.log(JSON.stringify({
      measurement_completed: 1,
      database_measurement_skipped: 1,
      ...structuralMetrics,
    }));
    return;
  }
  const organization = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    return tx.organization.findFirst({ select: { id: true } });
  });
  if (!organization) throw new Error("Keine Organisation für die Messung gefunden.");

  const db = tenantDb(organization.id);
  const samples = {
    orgContext: [],
    tenantFiveSequential: [],
    tenantFiveParallel: [],
    sharedTransactionFiveSequential: [],
    sharedTransactionFiveParallel: [],
    stockProductOptions: [],
    purchaseProductOptions: [],
    saleSellablePositions: [],
  };
  const rowCounts = {
    stockProductOptions: 0,
    purchaseProductOptions: 0,
    saleSellablePositions: 0,
  };

  const countOperations = (client) => [
    () => client.product.count(),
    () => client.inventoryPosition.count(),
    () => client.purchase.count(),
    () => client.sale.count(),
    () => client.platform.count(),
  ];

  for (let index = 0; index < repeatCount; index += 1) {
    samples.orgContext.push((await measure(() => prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
      await tx.membership.findFirst({
        where: { organizationId: organization.id },
        select: { id: true },
      });
    }))).durationMs);

    samples.tenantFiveSequential.push((await measure(async () => {
      for (const operation of countOperations(db)) await operation();
    })).durationMs);

    samples.tenantFiveParallel.push((await measure(() =>
      Promise.all(countOperations(db).map((operation) => operation()))
    )).durationMs);

    samples.sharedTransactionFiveSequential.push((await measure(() =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
        for (const operation of countOperations(tx)) await operation();
      })
    )).durationMs);

    samples.sharedTransactionFiveParallel.push((await measure(() =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organization.id}, TRUE)`;
        await Promise.all(countOperations(tx).map((operation) => operation()));
      })
    )).durationMs);

    const stockProducts = await measure(() => db.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        variant: true,
        size: true,
        ean: true,
        category: true,
        defaultPriceCents: true,
      },
      take: 500,
    }));
    samples.stockProductOptions.push(stockProducts.durationMs);
    rowCounts.stockProductOptions = stockProducts.result.length;

    const purchaseProducts = await measure(() => db.product.findMany({
      select: { id: true, name: true, variant: true, imageUrls: true },
      orderBy: { name: "asc" },
      take: 1000,
    }));
    samples.purchaseProductOptions.push(purchaseProducts.durationMs);
    rowCounts.purchaseProductOptions = purchaseProducts.result.length;

    const sellablePositions = await measure(() => db.inventoryPosition.findMany({
      where: { active: true, quantityAvailable: { gt: 0 } },
      include: { product: true, consignmentLot: true },
      orderBy: [{ inventoryType: "asc" }, { receivedAt: "asc" }],
      take: 500,
    }));
    samples.saleSellablePositions.push(sellablePositions.durationMs);
    rowCounts.saleSellablePositions = sellablePositions.result.length;
  }

  const medians = Object.fromEntries(
    Object.entries(samples).map(([name, values]) => [name, rounded(median(values))])
  );
  console.log(JSON.stringify({
    measurement_completed: 1,
    repeat_count: repeatCount,
    ...structuralMetrics,
    ...medians,
    metrics: medians,
    row_counts: rowCounts,
    samples: Object.fromEntries(
      Object.entries(samples).map(([name, values]) => [name, values.map(rounded)])
    ),
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Unbekannter Messfehler");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
