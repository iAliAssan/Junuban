import { redirect } from "next/navigation";
import { buildProductQuery } from "@/lib/api";
import { parseProductListSearchParams } from "@/lib/search-params";

export default function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // /search is a thin alias for the real catalog listing at /products —
  // keeping filtering/sorting/pagination logic in one place rather than
  // duplicating it (see IMPLEMENTATION_STATUS.md for the reasoning).
  const query = parseProductListSearchParams(searchParams);
  redirect(`/products${buildProductQuery(query)}`);
}
