import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { createServer } from "vite";

const repeatCount = Math.max(5, Number.parseInt(process.env.PERFORMANCE_REPEAT ?? "5", 10));
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

class MeasurementTrace {
  spans = [];
  databaseQueries = 0;
  activeDbQueries = 0;
  maximumDbConcurrency = 0;

  async measureDb(name, task, queryCount = 1) {
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

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function rounded(value) {
  return Math.round(value * 10) / 10;
}

function isPoolerError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("EMAXCONNSESSION") || message.includes("Max client connections reached");
}

async function loadBenchmarkContext() {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    const organization = await tx.organization.findFirst({
      select: { id: true, lowStockThreshold: true },
    });
    if (!organization) throw new Error("Keine Organisation fuer die Messung gefunden.");
    const [membership, position] = await Promise.all([
      tx.membership.findFirst({
        where: { organizationId: organization.id },
        select: { userId: true },
      }),
      tx.inventoryPosition.findFirst({
        where: { organizationId: organization.id, inventoryType: "OWNED" },
        select: {
          id: true,
          itemCondition: true,
          location: true,
          notes: true,
          product: {
            select: { name: true, variant: true, size: true, ean: true, imageUrls: true },
          },
          ownedLot: { select: { ean: true, imageUrls: true } },
        },
      }),
    ]);
    return { organization, membership, position };
  });
}

async function main() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    resolve: { alias: { "@": process.cwd() } },
    logLevel: "silent",
  });
  try {
    const [{ loadLagerInitialQueries }, metadataModule, context] = await Promise.all([
      vite.ssrLoadModule("/lib/stock/lager-query-loader.ts"),
      vite.ssrLoadModule("/lib/stock/stock-metadata-service.ts"),
      loadBenchmarkContext(),
    ]);
    const db = tenantDb(context.organization.id);
    const runLoader = async () => {
      const trace = new MeasurementTrace();
      const startedAt = performance.now();
      const result = await loadLagerInitialQueries({
        db,
        organizationId: context.organization.id,
        lowStockThreshold: context.organization.lowStockThreshold,
        params: {},
        view: "standard",
        trace,
        seedMissingOptions: false,
      });
      return {
        durationMs: performance.now() - startedAt,
        trace,
        counts: {
          inventoryPositions: result.ownedPositions.length,
          legacyStockItems: result.items.length,
        },
      };
    };

    await runLoader();
    const loaderSamples = [];
    const querySamples = [];
    let loaderDbQueries = 0;
    let loaderMaxConcurrency = 0;
    let poolerErrors = 0;
    let rowCounts = { inventoryPositions: 0, legacyStockItems: 0 };
    for (let index = 0; index < repeatCount; index += 1) {
      try {
        const sample = await runLoader();
        loaderSamples.push(rounded(sample.durationMs));
        querySamples.push(sample.trace.spans);
        loaderDbQueries = sample.trace.databaseQueries;
        loaderMaxConcurrency = Math.max(loaderMaxConcurrency, sample.trace.maximumDbConcurrency);
        rowCounts = sample.counts;
      } catch (error) {
        if (isPoolerError(error)) poolerErrors += 1;
        else throw error;
      }
    }

    let metadataServiceNoopMs = 0;
    if (context.membership && context.position?.ownedLot) {
      const imageUrls = context.position.ownedLot.imageUrls.length > 0
        ? context.position.ownedLot.imageUrls
        : context.position.product.imageUrls;
      const startedAt = performance.now();
      const result = await metadataModule.updateInventoryPositionMetadata({
        organizationId: context.organization.id,
        inventoryPositionId: context.position.id,
        userId: context.membership.userId,
        productName: context.position.product.name,
        variant: context.position.product.variant,
        size: context.position.product.size,
        ean: context.position.ownedLot.ean ?? context.position.product.ean,
        itemCondition: context.position.itemCondition,
        imageUrls,
        location: context.position.location,
        notes: context.position.notes,
      });
      if (result.changed) throw new Error("Die No-op-Metadatenmessung hat unerwartet Daten veraendert.");
      metadataServiceNoopMs = rounded(performance.now() - startedAt);
    }

    const completed = loaderSamples.length === repeatCount && poolerErrors === 0;
    console.log(JSON.stringify({
      measurementCompleted: completed ? 1 : 0,
      repeatCount,
      loaderMedianMs: loaderSamples.length ? rounded(median(loaderSamples)) : 0,
      loaderSlowestMs: loaderSamples.length ? Math.max(...loaderSamples) : 0,
      metadataServiceNoopMs,
      loaderDbQueries,
      loaderMaxConcurrency,
      poolerErrors,
      rowCounts,
      loaderSamples,
      querySamples,
    }));
  } finally {
    await vite.close();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Unbekannter Messfehler");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
