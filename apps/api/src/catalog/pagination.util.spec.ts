import { resolvePagination, totalPages, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from "./pagination.util";

describe("resolvePagination", () => {
  it("defaults to page 1 / DEFAULT_PAGE_SIZE when nothing is provided", () => {
    expect(resolvePagination(undefined, undefined)).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    });
  });

  it("computes skip/take correctly for a mid-range page", () => {
    expect(resolvePagination(3, 20)).toEqual({ page: 3, pageSize: 20, skip: 40, take: 20 });
  });

  it("clamps an oversized pageSize to MAX_PAGE_SIZE regardless of client input", () => {
    const result = resolvePagination(1, 999999);
    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    expect(result.take).toBe(MAX_PAGE_SIZE);
  });

  it("clamps page numbers below 1 back to 1", () => {
    expect(resolvePagination(0, 10).page).toBe(1);
    expect(resolvePagination(-5, 10).page).toBe(1);
  });

  it("falls back to defaults for non-finite/garbage input rather than throwing", () => {
    expect(resolvePagination(Number.NaN, Number.NaN)).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    });
  });

  it("floors fractional page/pageSize values", () => {
    expect(resolvePagination(2.9, 10.9)).toEqual({ page: 2, pageSize: 10, skip: 20, take: 10 });
  });
});

describe("totalPages", () => {
  it("always returns at least 1 page even for zero results", () => {
    expect(totalPages(0, 24)).toBe(1);
  });

  it("rounds up partial pages", () => {
    expect(totalPages(25, 24)).toBe(2);
    expect(totalPages(48, 24)).toBe(2);
    expect(totalPages(49, 24)).toBe(3);
  });
});
