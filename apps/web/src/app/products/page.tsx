import type { Metadata } from "next";
import { apiGet, buildProductQuery, classifyLoadError } from "@/lib/api";
import type { CategorySummary, ProducerSummary, ProductListResponse } from "@/lib/api";
import { parseProductListSearchParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/breadcrumbs/breadcrumbs";
import { FilterToolbar } from "@/components/product-filters/filter-toolbar";
import { CatalogGrid } from "@/components/catalog-grid/catalog-grid";
import { Pagination } from "@/components/pagination/pagination";
import styles from "./products-page.module.css";

export const metadata: Metadata = {
  title: "محصولات",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = parseProductListSearchParams(searchParams);

  const [categoriesResult, producersResult, productsResult] = await Promise.allSettled([
    apiGet<CategorySummary[]>("/categories"),
    apiGet<ProducerSummary[]>("/producers"),
    apiGet<ProductListResponse>(`/products${buildProductQuery(query)}`),
  ]);

  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const producers = producersResult.status === "fulfilled" ? producersResult.value : [];

  // Only ever set when the request itself failed (network/API error) —
  // a successful response with an empty `items` array never reaches this
  // branch, so it can never be mistaken for "no products found".
  const loadError = classifyLoadError(productsResult);

  const productList: ProductListResponse =
    productsResult.status === "fulfilled"
      ? productsResult.value
      : { items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 };

  return (
    <div className={styles.layout}>
      <Breadcrumbs
        baseUrl={process.env.APP_URL ?? "http://localhost:3000"}
        items={[{ label: "خانه", href: "/" }, { label: "محصولات" }]}
      />

      <div className="container">
        <h1 className={styles.title}>همه محصولات</h1>

        <FilterToolbar action="/products" categories={categories} producers={producers} current={query} />

        <CatalogGrid products={productList.items} total={productList.total} loadError={loadError} />

        <Pagination
          currentPage={productList.page}
          totalPages={productList.totalPages}
          buildHref={(page) => `/products${buildProductQuery({ ...query, page })}`}
        />
      </div>
    </div>
  );
}
