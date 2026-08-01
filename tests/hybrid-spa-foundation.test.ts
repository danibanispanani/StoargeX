import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAppQueryClient,
  getQueryStaleTime,
  OPERATIONAL_STALE_TIME_MS,
  QUERY_CACHE_TIME_MS,
  REFERENCE_STALE_TIME_MS,
  resetOrganizationCache,
} from "@/lib/query/query-client";
import {
  HttpClientError,
  requestJson,
  shouldRetryRequest,
} from "@/lib/query/http-client";
import {
  normalizeQueryParameters,
  queryKeys,
} from "@/lib/query/query-keys";
import { invalidationKeysForModule } from "@/lib/query/invalidation-map";

describe("Hybrid-SPA foundation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("reuses one QueryClient across browser-side provider renders", async () => {
    vi.stubGlobal("window", {});
    vi.resetModules();
    const { getAppQueryClient } = await import("@/lib/query/query-client");

    const firstRenderClient = getAppQueryClient();
    const rerenderClient = getAppQueryClient();

    expect(rerenderClient).toBe(firstRenderClient);
  });

  it("creates different query keys for different organizations", () => {
    const query = { q: "Sneaker", page: 2 };

    expect(queryKeys.resource("org-a", "lager", "list", query)).not.toEqual(
      queryKeys.resource("org-b", "lager", "list", query)
    );
  });

  it("normalizes semantically equivalent query parameters deterministically", () => {
    const fromObject = normalizeQueryParameters(
      {
        status: ["open", "closed"],
        page: 1,
        q: "Sneaker",
        empty: "",
      },
      { defaults: { page: 1 }, unorderedKeys: ["status"] }
    );
    const fromUrl = normalizeQueryParameters(
      new URLSearchParams([
        ["q", "Sneaker"],
        ["status", "closed"],
        ["page", "1"],
        ["status", "open"],
      ]),
      { defaults: { page: 1 }, unorderedKeys: ["status"] }
    );

    expect(fromObject).toEqual(fromUrl);
    expect(Object.keys(fromObject)).toEqual(["q", "status"]);
  });

  it("preserves order for query parameters that are not declared as sets", () => {
    const first = normalizeQueryParameters({ sort: ["priority", "createdAt"] });
    const second = normalizeQueryParameters({ sort: ["createdAt", "priority"] });

    expect(first).not.toEqual(second);
  });

  it("normalizes raw query input inside the key factory", () => {
    const first = queryKeys.resource(
      "org-a",
      "lager",
      "list",
      { status: ["open", "closed"], page: 1 },
      { defaults: { page: 1 }, unorderedKeys: ["status"] }
    );
    const second = queryKeys.resource(
      "org-a",
      "lager",
      "list",
      new URLSearchParams([
        ["status", "closed"],
        ["page", "1"],
        ["status", "open"],
      ]),
      { defaults: { page: 1 }, unorderedKeys: ["status"] }
    );

    expect(first).toEqual(second);
  });

  it("clears only the previous organization cache after a confirmed switch", () => {
    const queryClient = createAppQueryClient();
    const oldKey = queryKeys.resource("org-a", "lager", "list", {});
    const newKey = queryKeys.resource("org-b", "lager", "list", {});
    queryClient.setQueryData(oldKey, ["old tenant"]);
    queryClient.setQueryData(newKey, ["new tenant"]);

    resetOrganizationCache(queryClient, "org-a", "org-b");

    expect(queryClient.getQueryData(oldKey)).toBeUndefined();
    expect(queryClient.getQueryData(newKey)).toEqual(["new tenant"]);
  });

  it("uses the documented operational, reference, and retention defaults", () => {
    const queryClient = createAppQueryClient();
    const defaults = queryClient.getDefaultOptions().queries;
    const staleTime = defaults?.staleTime;

    expect(typeof staleTime).toBe("function");
    expect(
      getQueryStaleTime(queryKeys.resource("org-a", "lager", "list", {}))
    ).toBe(OPERATIONAL_STALE_TIME_MS);
    expect(
      getQueryStaleTime(
        queryKeys.resource("org-a", "reference", "stock-options")
      )
    ).toBe(REFERENCE_STALE_TIME_MS);
    expect(defaults?.gcTime).toBe(QUERY_CACHE_TIME_MS);
  });

  it("maps invalidations to organization-scoped module roots", () => {
    const keys = invalidationKeysForModule("org-a", "verkauf");

    expect(keys).toContainEqual(queryKeys.module("org-a", "verkauf"));
    expect(keys).toContainEqual(queryKeys.module("org-a", "lager"));
    expect(keys.every((key) => key[1] === "org-a")).toBe(true);
  });

  it.each([
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [422, "VALIDATION_ERROR"],
  ])("does not retry HTTP %i errors", (status, code) => {
    const error = new HttpClientError({
      status,
      code,
      message: "Request rejected",
    });

    expect(shouldRetryRequest(0, error)).toBe(false);
  });

  it.each([
    new HttpClientError({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Try again later",
    }),
    new HttpClientError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Network unavailable",
    }),
  ])("retries transient failures at most once", (error) => {
    expect(shouldRetryRequest(0, error)).toBe(true);
    expect(shouldRetryRequest(1, error)).toBe(false);
  });

  it("keeps a malformed 401 response classified as non-retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{", {
          status: 401,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const error = await requestJson("/api/private", {}, () => null).catch(
      (caught) => caught
    );

    expect(error).toBeInstanceOf(HttpClientError);
    expect(error).toMatchObject({ status: 401, code: "HTTP_401" });
    expect(shouldRetryRequest(0, error)).toBe(false);
  });

  it("validates successful JSON through the caller-provided decoder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ value: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const result = await requestJson("/api/value", {}, (body) => {
      if (!body || typeof body !== "object" || !("value" in body)) {
        throw new Error("missing value");
      }
      return String(body.value);
    });

    expect(result).toBe("ok");
  });

  it("does not classify malformed successful JSON as a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{", {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const error = await requestJson("/api/value", {}, () => null).catch(
      (caught) => caught
    );

    expect(error).toMatchObject({
      status: 200,
      code: "INVALID_JSON_RESPONSE",
    });
    expect(shouldRetryRequest(0, error)).toBe(false);
  });

  it("lets a decoder define the result of an empty 204 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    );

    await expect(
      requestJson("/api/empty", {}, (body) => {
        expect(body).toBeUndefined();
        return "empty" as const;
      })
    ).resolves.toBe("empty");
  });

  it("does not retry a request aborted with a custom reason", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled by caller");
    controller.abort(reason);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(reason));

    const error = await requestJson(
      "/api/value",
      { signal: controller.signal },
      () => null
    ).catch((caught) => caught);

    expect(error).toBe(reason);
    expect(shouldRetryRequest(0, error)).toBe(false);
  });

  it("guards organization switching and sign-out cache clearing at the client boundary", () => {
    const switcher = readFileSync(
      "components/layout/organization-switcher.tsx",
      "utf8"
    );
    const signOutForm = readFileSync(
      "components/providers/sign-out-cache-reset-form.tsx",
      "utf8"
    );

    expect(switcher).toContain("if (switchInFlight.current) return");
    expect(switcher).toContain("disabled={isSwitching ||");
    expect(signOutForm).toContain("queryClient.clear()");
  });

  it("keeps the lager route on its existing unmigrated server path", () => {
    const lagerPage = readFileSync("app/(app)/lager/page.tsx", "utf8");

    expect(lagerPage).toContain("loadLagerInitialQueries");
    expect(lagerPage).toContain("<StockTable");
    expect(lagerPage).not.toContain("useQuery(");
    expect(lagerPage).not.toContain("/api/lager");
  });
});
