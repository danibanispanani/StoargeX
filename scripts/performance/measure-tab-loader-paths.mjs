import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { createServer } from "vite";

const repeatCount = Math.max(5, Number.parseInt(process.env.PERFORMANCE_REPEAT ?? "5", 10));
const requestedTabs = new Set(
  (process.env.PERFORMANCE_TABS ?? "verkauf,lager,einkauf,produkte")
    .split(",")
    .map((tab) => tab.trim())
    .filter(Boolean)
);
const prisma = new PrismaClient();

function rounded(value) {
  return Math.round(value * 10) / 10;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function summarize(values) {
  return {
    medianMs: values.length ? rounded(median(values)) : 0,
    slowestMs: values.length ? Math.max(...values.map(rounded)) : 0,
    samplesMs: values.map(rounded),
  };
}

class MeasurementTrace {
  spans = [];
  databaseQueries = 0;
  activeDbQueries = 0;
  maximumDbConcurrency = 0;

  async measureDb(name, task, queryCount = 2) {
    const startedAt = performance.now();
    this.databaseQueries += queryCount;
    this.activeDbQueries += queryCount;
    this.maximumDbConcurrency = Math.max(this.maximumDbConcurrency, this.activeDbQueries);
    try {
      return await task();
    } finally {
      this.activeDbQueries -= queryCount;
      this.spans.push({ name, durationMs: rounded(performance.now() - startedAt) });
    }
  }
}

async function loadBenchmarkContext() {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    const organization = await tx.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, lowStockThreshold: true },
    });
    if (!organization) throw new Error("Keine Organisation fuer die Messung gefunden.");
    const membership = await tx.membership.findFirst({
      where: { organizationId: organization.id },
      select: { userId: true },
    });
    if (!membership) throw new Error("Keine Mitgliedschaft fuer die Messung gefunden.");
    return { organization, membership };
  });
}

async function measureFreshOrgLookup(organizationId, userId) {
  const startedAt = performance.now();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    await tx.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: { organization: true },
    });
  });
  return performance.now() - startedAt;
}

async function measureTab(name, task) {
  const trace = new MeasurementTrace();
  const startedAt = performance.now();
  const result = await task(trace);
  return {
    name,
    durationMs: performance.now() - startedAt,
    trace,
    ...result,
  };
}

async function measureSales({ db, organization, modules }) {
  return measureTab("verkauf", async (trace) => {
    const result = await modules.sales.loadSalesInitialRead({
      db,
      organizationId: organization.id,
      params: {},
      view: "standard",
      trace,
    });
    return {
      rowCounts: result.rowCounts,
      payloadBytes: jsonBytes(result),
    };
  });
}

async function measureLager({ db, organization, modules }) {
  return measureTab("lager", async (trace) => {
    const result = await modules.stock.loadLagerInitialQueries({
      db,
      organizationId: organization.id,
      lowStockThreshold: organization.lowStockThreshold,
      params: {},
      view: "standard",
      trace,
      seedMissingOptions: false,
    });
    return {
      rowCounts: {
        inventoryPositions: result.ownedPositions.length,
        legacyStockItems: result.items.length,
        platforms: result.platforms.length,
        lowAlerts: result.lowAlerts.length,
      },
      payloadBytes: jsonBytes({
        ownedPositions: result.ownedPositions,
        items: result.items,
        platforms: result.platforms,
        zmOptions: result.zmOptions,
        storageLocations: result.storageLocations,
        lowAlerts: result.lowAlerts,
      }),
    };
  });
}

async function measureEinkauf({ db, organization, modules }) {
  return measureTab("einkauf", async (trace) => {
    const result = await modules.purchaseRead.loadPurchaseInitialRead({
      db,
      organizationId: organization.id,
      params: {},
      trace,
    });
    return {
      rowCounts: result.rowCounts,
      payloadBytes: jsonBytes(result),
    };
  });
}

async function measureProdukte({ db, organization, modules }) {
  return measureTab("produkte", async (trace) => {
    const result = await modules.productRead.loadProductInitialRead({
      db,
      organizationId: organization.id,
      params: {},
      lowStockThreshold: organization.lowStockThreshold,
      trace,
    });
    return {
      rowCounts: result.rowCounts,
      payloadBytes: jsonBytes(result),
    };
  });
}

function summarizeTab(samples) {
  const durations = samples.map((sample) => sample.durationMs);
  const latest = samples.at(-1);
  return {
    ...summarize(durations),
    databaseQueries: latest?.trace.databaseQueries ?? 0,
    maximumDbConcurrency: latest?.trace.maximumDbConcurrency ?? 0,
    spans: latest?.trace.spans ?? [],
    rowCounts: latest?.rowCounts ?? {},
    payloadBytesMedian: summarize(samples.map((sample) => sample.payloadBytes)).medianMs,
    payloadBytesSlowest: summarize(samples.map((sample) => sample.payloadBytes)).slowestMs,
  };
}

const tabRunners = {
  verkauf: measureSales,
  lager: measureLager,
  einkauf: measureEinkauf,
  produkte: measureProdukte,
};

async function main() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    resolve: { alias: { "@": process.cwd() } },
    logLevel: "silent",
  });
  try {
    const tenantModule = await vite.ssrLoadModule("/lib/tenant-db.ts");
    const sales = requestedTabs.has("verkauf")
      ? await vite.ssrLoadModule("/lib/sales/sales-read-loader.ts")
      : null;
    const stock = requestedTabs.has("lager")
      ? await vite.ssrLoadModule("/lib/stock/lager-query-loader.ts")
      : null;
    const purchaseRead = requestedTabs.has("einkauf")
      ? await vite.ssrLoadModule("/lib/purchases/purchase-read-loader.ts")
      : null;
    const productRead = requestedTabs.has("produkte")
      ? await vite.ssrLoadModule("/lib/products/product-read-loader.ts")
      : null;
    const context = await loadBenchmarkContext();
    const db = tenantModule.tenantDb(context.organization.id);
    const modules = { sales, stock, purchaseRead, productRead };

    await measureFreshOrgLookup(context.organization.id, context.membership.userId);
    for (const tab of requestedTabs) {
      const runner = tabRunners[tab];
      if (runner) await runner({ db, organization: context.organization, modules });
    }

    const authOrgLookupSamples = [];
    const samples = Object.fromEntries([...requestedTabs].map((tab) => [tab, []]));
    for (let index = 0; index < repeatCount; index += 1) {
      authOrgLookupSamples.push(
        await measureFreshOrgLookup(context.organization.id, context.membership.userId)
      );
      for (const tab of requestedTabs) {
        const runner = tabRunners[tab];
        if (runner) samples[tab].push(await runner({ db, organization: context.organization, modules }));
      }
    }

    console.log(JSON.stringify({
      measurement_completed: 1,
      repeat_count: repeatCount,
      tabs_requested: [...requestedTabs],
      method: "server_loader_db_paths_without_browser_cookie",
      browser_http_pages_measured: 0,
      compile_time_included: 0,
      auth_org_lookup: summarize(authOrgLookupSamples),
      tabs: Object.fromEntries(
        Object.entries(samples).map(([name, tabSamples]) => [name, summarizeTab(tabSamples)])
      ),
    }, null, 2));
  } finally {
    await vite.close();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : "Unbekannter Messfehler");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
