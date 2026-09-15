import { parseProductListSearchParams } from "./search-params";

describe("parseProductListSearchParams", () => {
  it("defaults to page 1 and no filters for an empty query", () => {
    expect(parseProductListSearchParams({})).toEqual({
      q: undefined,
      categorySlug: undefined,
      producerSlug: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      inStockOnly: false,
      sort: undefined,
      page: 1,
    });
  });

  it("parses a full, valid query", () => {
    const result = parseProductListSearchParams({
      q: "خرما",
      categorySlug: "dates",
      producerSlug: "minab-dates-co",
      minPrice: "100000",
      maxPrice: "500000",
      inStockOnly: "true",
      sort: "price_asc",
      page: "2",
    });
    expect(result).toEqual({
      q: "خرما",
      categorySlug: "dates",
      producerSlug: "minab-dates-co",
      minPrice: 100000,
      maxPrice: 500000,
      inStockOnly: true,
      sort: "price_asc",
      page: 2,
    });
  });

  it("rejects an invalid sort value rather than forwarding it to the API", () => {
    expect(parseProductListSearchParams({ sort: "'; DROP TABLE products;--" }).sort).toBeUndefined();
  });

  it("clamps a non-positive page back to 1", () => {
    expect(parseProductListSearchParams({ page: "0" }).page).toBe(1);
    expect(parseProductListSearchParams({ page: "-3" }).page).toBe(1);
  });

  it("ignores non-numeric price params instead of forwarding NaN", () => {
    expect(parseProductListSearchParams({ minPrice: "abc" }).minPrice).toBeUndefined();
  });

  it("takes the first value when Next.js provides an array (repeated query key)", () => {
    expect(parseProductListSearchParams({ q: ["first", "second"] }).q).toBe("first");
  });

  it("truncates an overly long search string", () => {
    const longQuery = "a".repeat(500);
    const result = parseProductListSearchParams({ q: longQuery });
    expect(result.q?.length).toBe(120);
  });

  it("only treats the literal string 'true' as inStockOnly=true", () => {
    expect(parseProductListSearchParams({ inStockOnly: "1" }).inStockOnly).toBe(false);
    expect(parseProductListSearchParams({ inStockOnly: "yes" }).inStockOnly).toBe(false);
  });
});
