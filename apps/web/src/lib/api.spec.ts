import { apiGet, apiGetOrNotFound, classifyLoadError, ApiError } from "./api";

describe("apiGet error handling", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it("wraps a network-level failure (API completely unreachable) as ApiError", async () => {
    // This is the exact scenario sitemap.ts must survive: the API isn't
    // running at all, so fetch() itself rejects (connection refused /
    // DNS failure), rather than resolving with a non-2xx response.
    global.fetch = jest.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(apiGet("/categories")).rejects.toBeInstanceOf(ApiError);
  });

  it("wraps a non-2xx HTTP response as ApiError with the response status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal error" }),
    });

    await expect(apiGet("/categories")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
    });
  });

  it("resolves normally for a successful response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "1" }],
    });

    await expect(apiGet("/categories")).resolves.toEqual([{ id: "1" }]);
  });

  it("resolves normally (does not throw) for a successful response with an empty catalog — an empty result is never an error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 }),
    });

    await expect(apiGet("/products")).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 24,
      total: 0,
      totalPages: 1,
    });
  });

  it("a network-level ApiError has no HTTP status, distinguishing it from a 404", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));

    try {
      await apiGet("/products/some-slug");
      fail("expected apiGet to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBeUndefined();
    }
  });
});

describe("apiGetOrNotFound", () => {
  it("resolves to null for a real 404 (missing slug)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not found" }),
    });

    await expect(apiGetOrNotFound("/products/does-not-exist")).resolves.toBeNull();
  });

  it("still throws (does not treat as not-found) when the API is completely unreachable", async () => {
    // A down API must surface as a real error, not silently render a
    // false "this product doesn't exist" page.
    global.fetch = jest.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(apiGetOrNotFound("/products/some-slug")).rejects.toBeInstanceOf(ApiError);
  });

  it("still throws for a non-404 HTTP error (e.g. 500)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal error" }),
    });

    await expect(apiGetOrNotFound("/products/some-slug")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("classifyLoadError", () => {
  it("returns undefined for a fulfilled result with a normal non-empty payload", () => {
    const result: PromiseSettledResult<unknown> = { status: "fulfilled", value: [{ id: "1" }] };
    expect(classifyLoadError(result)).toBeUndefined();
  });

  it("returns undefined for a fulfilled result with an EMPTY payload — an empty catalog is never an error", () => {
    const result: PromiseSettledResult<unknown> = {
      status: "fulfilled",
      value: { items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 },
    };
    expect(classifyLoadError(result)).toBeUndefined();
  });

  it("returns a message for a rejected result caused by an ApiError (network or HTTP failure)", () => {
    const result: PromiseSettledResult<unknown> = {
      status: "rejected",
      reason: new ApiError("network down"),
    };
    expect(classifyLoadError(result)).toEqual(expect.any(String));
  });

  it("returns a (different, generic) message for a rejected result NOT caused by an ApiError", () => {
    const apiErrorResult: PromiseSettledResult<unknown> = {
      status: "rejected",
      reason: new ApiError("network down"),
    };
    const unexpectedErrorResult: PromiseSettledResult<unknown> = {
      status: "rejected",
      reason: new TypeError("some unrelated bug"),
    };
    expect(classifyLoadError(apiErrorResult)).not.toEqual(classifyLoadError(unexpectedErrorResult));
  });
});
