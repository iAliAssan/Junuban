import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGet, apiGetOrNotFound, buildProductQuery, classifyLoadError } from "@/lib/api";
import type { CategorySummary, ProducerSummary, ProductListResponse } from "@/lib/api";
import { parseProductListSearchParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/breadcrumbs/breadcrumbs";
import { FilterToolbar } from "@/components/product-filters/filter-toolbar";
import { CatalogGrid } from "@/components/catalog-grid/catalog-grid";
import { Pagination } from "@/components/pagination/pagination";
import styles from "../../products/products-page.module.css";

export async function generateMetadata({
  params,
}: {
  params: { categorySlug: string };
}): Promise<Metadata> {
  const category = await apiGetOrNotFound<CategorySummary>(`/categories/${params.categorySlug}`);
  if (!category) return {};

  return {
    title: category.name,
    description: `خرید ${category.name} اصیل جنوب ایران، مستقیم از تولیدکننده.`,
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { categorySlug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const category = await apiGetOrNotFound<CategorySummary>(`/categories/${params.categorySlug}`);
  if (!category) {
    notFound();
  }

  const query = { ...parseProductListSearchParams(searchParams), categorySlug: category.slug };

  const [categoriesResult, producersResult, productsResult] = await Promise.allSettled([
    apiGet<CategorySummary[]>("/categories"),
    apiGet<ProducerSummary[]>("/producers"),
    apiGet<ProductListResponse>(`/products${buildProductQuery(query)}`),
  ]);

  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const producers = producersResult.status === "fulfilled" ? producersResult.value : [];

  const loadError = classifyLoadError(productsResult);

  const productList: ProductListResponse =
    productsResult.status === "fulfilled"
      ? productsResult.value
      : { items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 };

  return (
    <div className={styles.layout}>
      <Breadcrumbs
        baseUrl={process.env.APP_URL ?? "http://localhost:3000"}
        items={[{ label: "خانه", href: "/" }, { label: "محصولات", href: "/products" }, { label: category.name }]}
      />

      <div className="container">
        <h1 className={styles.title}>{category.name}</h1>

        <FilterToolbar
          action={`/category/${category.slug}`}
          categories={categories}
          producers={producers}
          current={query}
          lockCategorySlug={category.slug}
        />

        <CatalogGrid products={productList.items} total={productList.total} loadError={loadError} />

        <Pagination
          currentPage={productList.page}
          totalPages={productList.totalPages}
          buildHref={(page) => `/category/${category.slug}${buildProductQuery({ ...query, page })}`}
        />
      </div>
    </div>
  );
}
