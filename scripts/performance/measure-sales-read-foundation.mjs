import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { createServer } from "vite";

const repeatCount = Math.max(5, Number.parseInt(process.env.PERFORMANCE_REPEAT ?? "5", 10));
const variantMode = (process.env.PERFORMANCE_SALES_VARIANTS ?? "optimized").toLowerCase();
const runBaseline = variantMode === "baseline" || variantMode === "all";
const runOptimized = variantMode === "optimized" || variantMode === "all";
const runSharedTransactions = variantMode === "shared" || variantMode === "all";
const runIsolationProofEnabled = process.env.PERFORMANCE_RLS_PROOF === "1";
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

function summarizeSamples(values) {
  return {
    medianMs: values.length ? rounded(median(values)) : 0,
    slowestMs: values.length ? Math.max(...values.map(rounded)) : 0,
    samplesMs: values.map(rounded),
  };
}

class MeasurementTrace {
  spans = [];
  logicalQueryGroups = 0;
  rlsSetConfigCount = 0;
  activeGroups = 0;
  maximumJsConcurrency = 0;

  async measure(name, queryGroups, task) {
    const startedAt = performance.now();
    this.logicalQueryGroups += queryGroups;
    this.activeGroups += queryGroups;
    this.maximumJsConcurrency = Math.max(this.maximumJsConcurrency, this.activeGroups);
    try {
      return await task();
    } finally {
      this.activeGroups -= queryGroups;
      this.spans.push({ name, durationMs: rounded(performance.now() - startedAt) });
    }
  }

  async measureDb(name, task, queryCount = 1) {
    return this.measure(name, queryCount, task);
  }
}

async function loadBenchmarkContext() {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    const organization = await tx.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!organization) throw new Error("Keine Organisation fuer die Messung gefunden.");
    const membership = await tx.membership.findFirst({
      where: { organizationId: organization.id },
      select: { userId: true, role: true },
    });
    if (!membership) throw new Error("Keine Mitgliedschaft fuer die Messung gefunden.");
    const comparisonOrganizations = await tx.organization.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      take: 2,
    });
    return { organization, membership, comparisonOrganizations };
  });
}

async function measureFreshOrgLookup(organizationId, userId) {
  const startedAt = performance.now();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
    await tx.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      include: { organization: true },
    });
  });
  return performance.now() - startedAt;
}

function saleWhere(viewWhere) {
  return { AND: [{}, viewWhere] };
}

async function loadSalesRead(db, organizationId, helpers, options = {}) {
  const trace = new MeasurementTrace();
  trace.rlsSetConfigCount = options.singleTransaction ? 1 : 6;
  const where = saleWhere(helpers.buildSaleViewWhere("standard"));
  const pageSize = 100;

  const readOptions = () =>
    Promise.all([
      trace.measure("sales.options.platforms", 1, () =>
        db.platform.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      ),
      trace.measure("sales.options.payout", 1, async () => {
        const options = await db.selectOption.findMany({
          where: { organizationId, kind: "PAYOUT_RECIPIENT", active: true },
          orderBy: { sortOrder: "asc" },
          select: { label: true },
        });
        return options.map((option) => option.label);
      }),
      trace.measure("sales.options.shipping_rates", 1, () =>
        db.shippingRate.findMany({
          where: { active: true },
          orderBy: [{ carrierName: "asc" }, { name: "asc" }],
          select: {
            id: true,
            carrierName: true,
            name: true,
            countries: true,
            baseCents: true,
          },
        })
      ),
      trace.measure("sales.options.marketplace_accounts", 1, () =>
        db.marketplaceAccount.findMany({
          where: { active: true },
          include: { defaultFeeSchedule: true },
          orderBy: { displayName: "asc" },
        })
      ),
    ]);

  const startedAt = performance.now();
  const optionsPromise = options.sequential ? null : readOptions();
  const totalResults = await trace.measure("sales.count", 1, () =>
    db.sale.count({ where })
  );
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const page = Math.min(1, totalPages);

  const salesTask = trace.measure("sales.list", 1, () =>
    db.sale.findMany({
      where,
      include: {
        platform: { select: { name: true } },
        debtLinks: {
          include: {
            debt: { select: { debtNumber: true, status: true } },
          },
        },
        saleLines: {
          include: {
            allocations: {
              include: {
                inventoryPosition: {
                  include: {
                    consignmentLot: true,
                  },
                },
              },
            },
          },
        },
        items: {
          include: {
            stockItem: { select: { sku: true, title: true, variant: true, size: true } },
            consignment: { select: { sku: true, itemTitle: true } },
          },
        },
      },
      orderBy: { soldAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
  );
  const [sales, [platforms, payoutOptions, rates, marketplaceAccounts]] = options.sequential
    ? [await salesTask, await readOptions()]
    : await Promise.all([salesTask, optionsPromise]);

  const result = {
    totalResults,
    sales,
    platforms,
    payoutOptions,
    rates,
    marketplaceAccounts,
  };
  return {
    durationMs: performance.now() - startedAt,
    trace,
    counts: {
      totalResults,
      sales: sales.length,
      platforms: platforms.length,
      payoutOptions: payoutOptions.length,
      shippingRates: rates.length,
      marketplaceAccounts: marketplaceAccounts.length,
    },
    payloadBytes: jsonBytes(result),
  };
}

async function runIsolationProof(helpers, context) {
  const [first, second] = context.comparisonOrganizations;
  if (!first || !second) {
    return { skipped: true, reason: "Weniger als zwei Organisationen vorhanden." };
  }
  return helpers.withTenantReadTransaction(first.id, async (tx) => {
    const [visibleOwnSales, visibleOtherSales, settingRows] = await Promise.all([
      tx.sale.count({ where: { organizationId: first.id } }),
      tx.sale.count({ where: { organizationId: second.id } }),
      tx.$queryRaw`SELECT current_setting('app.current_org_id', TRUE) AS org_id`,
    ]);
    return {
      skipped: false,
      organizationId: first.id,
      otherOrganizationId: second.id,
      visibleOwnSales,
      visibleOtherSales,
      currentSetting: settingRows[0]?.org_id ?? null,
      passed: settingRows[0]?.org_id === first.id && visibleOtherSales === 0,
    };
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
    const tenantModule = await vite.ssrLoadModule("/lib/tenant-db.ts");
    const saleTableModule = await vite.ssrLoadModule("/lib/sales/sale-table.ts");
    const salesReadModule = await vite.ssrLoadModule("/lib/sales/sales-read-loader.ts");
    const context = await loadBenchmarkContext();
    const helpers = {
      tenantDb: tenantModule.tenantDb,
      withTenantReadTransaction: tenantModule.withTenantReadTransaction,
      buildSaleViewWhere: saleTableModule.buildSaleViewWhere,
      loadSalesInitialRead: salesReadModule.loadSalesInitialRead,
    };

    await measureFreshOrgLookup(context.organization.id, context.membership.userId);
    if (runBaseline) {
      await loadSalesRead(
        helpers.tenantDb(context.organization.id),
        context.organization.id,
        helpers
      );
    }
    if (runOptimized) {
      await helpers.loadSalesInitialRead({
        db: helpers.tenantDb(context.organization.id),
        organizationId: context.organization.id,
        params: {},
        view: "standard",
        trace: new MeasurementTrace(),
      });
    }
    if (runSharedTransactions) {
      await helpers.withTenantReadTransaction(context.organization.id, (tx) =>
        loadSalesRead(tx, context.organization.id, helpers, { singleTransaction: true })
      );
    }

    const orgLookupSamples = [];
    const baselineSamples = [];
    const optimizedSamples = [];
    const sharedTransactionSamples = [];
    const sharedTransactionSequentialSamples = [];
    const payloadBytes = [];
    const optimizedPayloadBytes = [];
    let baselineTrace = null;
    let optimizedTrace = null;
    let sharedTransactionTrace = null;
    let rowCounts = null;
    let optimizedRowCounts = null;

    for (let index = 0; index < repeatCount; index += 1) {
      orgLookupSamples.push(
        await measureFreshOrgLookup(context.organization.id, context.membership.userId)
      );

      if (runBaseline) {
        const baseline = await loadSalesRead(
          helpers.tenantDb(context.organization.id),
          context.organization.id,
          helpers
        );
        baselineSamples.push(baseline.durationMs);
        baselineTrace = baseline.trace;
        rowCounts = baseline.counts;
        payloadBytes.push(baseline.payloadBytes);
      }

      if (runOptimized) {
        const optimizedTraceSample = new MeasurementTrace();
        const optimizedStartedAt = performance.now();
        const optimized = await helpers.loadSalesInitialRead({
          db: helpers.tenantDb(context.organization.id),
          organizationId: context.organization.id,
          params: {},
          view: "standard",
          trace: optimizedTraceSample,
        });
        optimizedSamples.push(performance.now() - optimizedStartedAt);
        optimizedTrace = optimizedTraceSample;
        optimizedRowCounts = optimized.rowCounts;
        optimizedPayloadBytes.push(jsonBytes(optimized));
      }

      if (runSharedTransactions) {
        const sharedStartedAt = performance.now();
        const shared = await helpers.withTenantReadTransaction(context.organization.id, (tx) =>
          loadSalesRead(tx, context.organization.id, helpers, { singleTransaction: true })
        );
        shared.durationMs = performance.now() - sharedStartedAt;
        sharedTransactionSamples.push(shared.durationMs);
        sharedTransactionTrace = shared.trace;

        const sharedSequentialStartedAt = performance.now();
        const sharedSequential = await helpers.withTenantReadTransaction(context.organization.id, (tx) =>
          loadSalesRead(tx, context.organization.id, helpers, {
            singleTransaction: true,
            sequential: true,
          })
        );
        sharedSequential.durationMs = performance.now() - sharedSequentialStartedAt;
        sharedTransactionSequentialSamples.push(sharedSequential.durationMs);
      }
    }

    const isolationProof = runIsolationProofEnabled
      ? await runIsolationProof(helpers, context)
      : { skipped: true, reason: "PERFORMANCE_RLS_PROOF ist nicht gesetzt." };
    console.log(JSON.stringify({
      measurement_completed: 1,
      repeat_count: repeatCount,
      variant_mode: variantMode,
      authenticated_browser_navigation_measured: 0,
      compile_time_included: 0,
      auth_org_lookup: summarizeSamples(orgLookupSamples),
      baseline_tenant_wrapper: {
        ...summarizeSamples(baselineSamples),
        logical_query_groups: baselineTrace?.logicalQueryGroups ?? 0,
        rls_set_config_count: baselineTrace?.rlsSetConfigCount ?? 0,
        maximum_js_query_group_concurrency: baselineTrace?.maximumJsConcurrency ?? 0,
        spans: baselineTrace?.spans ?? [],
      },
      optimized_sales_read_loader: {
        ...summarizeSamples(optimizedSamples),
        logical_query_groups: optimizedTrace?.logicalQueryGroups ?? 0,
        rls_set_config_count: 4,
        maximum_js_query_group_concurrency: optimizedTrace?.maximumJsConcurrency ?? 0,
        spans: optimizedTrace?.spans ?? [],
      },
      shared_transaction_parallel_syntax: {
        ...summarizeSamples(sharedTransactionSamples),
        logical_query_groups: sharedTransactionTrace?.logicalQueryGroups ?? 0,
        rls_set_config_count: sharedTransactionTrace?.rlsSetConfigCount ?? 0,
        maximum_js_query_group_concurrency: sharedTransactionTrace?.maximumJsConcurrency ?? 0,
        spans: sharedTransactionTrace?.spans ?? [],
      },
      shared_transaction_sequential: summarizeSamples(sharedTransactionSequentialSamples),
      data: {
        row_counts: rowCounts,
        optimized_row_counts: optimizedRowCounts,
        payload_bytes_median: payloadBytes.length ? rounded(median(payloadBytes)) : 0,
        payload_bytes_slowest: payloadBytes.length ? Math.max(...payloadBytes) : 0,
        optimized_payload_bytes_median: optimizedPayloadBytes.length ? rounded(median(optimizedPayloadBytes)) : 0,
        optimized_payload_bytes_slowest: optimizedPayloadBytes.length ? Math.max(...optimizedPayloadBytes) : 0,
      },
      rls_isolation_proof: isolationProof,
    }));
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
