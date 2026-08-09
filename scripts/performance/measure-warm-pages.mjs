import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";

const baseUrl = (process.env.PERFORMANCE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const repeatCount = Math.max(3, Number.parseInt(process.env.PERFORMANCE_REPEAT ?? "5", 10));
const paths = (process.env.PERFORMANCE_PATHS ?? "/verkauf,/lager,/einkauf,/produkte")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);
const timeoutMs = Math.max(1000, Number.parseInt(process.env.PERFORMANCE_TIMEOUT_MS ?? "30000", 10));

function rounded(value) {
  return Math.round(value * 10) / 10;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function readCookieHeader() {
  if (process.env.PERFORMANCE_COOKIE) return process.env.PERFORMANCE_COOKIE.trim();
  if (process.env.PERFORMANCE_COOKIE_FILE) {
    return readFileSync(process.env.PERFORMANCE_COOKIE_FILE, "utf8").trim();
  }
  return "";
}

function safeHeaders(headers) {
  return {
    cacheControl: headers.get("cache-control"),
    nextCache: headers.get("x-nextjs-cache"),
    nextMatchedPath: headers.get("x-matched-path"),
    serverTiming: headers.get("server-timing"),
  };
}

function isAuthRedirect(response, finalUrl) {
  if ([301, 302, 303, 307, 308].includes(response.status)) return true;
  return /\/(login|auth|signin)(?:[/?#]|$)/i.test(finalUrl);
}

function safeError(error) {
  return error instanceof Error ? error.message : "Unbekannter Messfehler";
}

async function requestPage(path, phase, cookieHeader) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "follow",
      signal: controller.signal,
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    await response.arrayBuffer();
    const durationMs = rounded(performance.now() - startedAt);
    return {
      path,
      phase,
      durationMs,
      status: response.status,
      finalPath: new URL(response.url).pathname,
      authRedirect: isAuthRedirect(response, response.url),
      coldCompileCandidate: phase === "warmup",
      headers: safeHeaders(response.headers),
    };
  } catch (error) {
    return {
      path,
      phase,
      durationMs: rounded(performance.now() - startedAt),
      status: null,
      finalPath: null,
      authRedirect: false,
      coldCompileCandidate: phase === "warmup",
      error: safeError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summarize(samples) {
  const durations = samples.map((sample) => sample.durationMs);
  return {
    count: samples.length,
    medianMs: durations.length ? rounded(median(durations)) : 0,
    slowestMs: durations.length ? Math.max(...durations) : 0,
    statuses: [...new Set(samples.map((sample) => sample.status).filter((status) => status !== null))],
    authRedirects: samples.filter((sample) => sample.authRedirect).length,
    errors: samples.filter((sample) => sample.error).length,
    samples,
  };
}

async function main() {
  const cookieHeader = readCookieHeader();
  const results = {};
  for (const path of paths) {
    const warmup = await requestPage(path, "warmup", cookieHeader);
    const warmSamples = [];
    for (let index = 0; index < repeatCount; index += 1) {
      warmSamples.push(await requestPage(path, "warm", cookieHeader));
    }
    results[path] = {
      warmup,
      warm: summarize(warmSamples),
    };
  }
  const allSamples = Object.values(results).flatMap((result) => [result.warmup, ...result.warm.samples]);
  const errorCount = allSamples.filter((sample) => sample.error).length;
  const authRedirectCount = allSamples.filter((sample) => sample.authRedirect).length;

  console.log(JSON.stringify({
    measurement_completed: errorCount === 0 ? 1 : 0,
    authenticated_app_pages_measured: cookieHeader.length > 0 && authRedirectCount === 0,
    base_url: baseUrl,
    repeat_count: repeatCount,
    request_mode: "sequential_http_get",
    opened_database_connections: 0,
    authenticated_cookie_supplied: cookieHeader.length > 0,
    compile_time_included_in_warm_samples: 0,
    request_errors: errorCount,
    auth_redirects: authRedirectCount,
    pages: results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unbekannter Messfehler");
  process.exitCode = 1;
});
