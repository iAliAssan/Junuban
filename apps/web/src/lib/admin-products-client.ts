const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new AdminApiError("ارتباط با سرور برقرار نشد.");
  }

  if (!res.ok) {
    let message = "درخواست با خطا مواجه شد";
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join("، ") : body.message;
    } catch {
      // keep generic message
    }
    throw new AdminApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export type AdminProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface AdminProductListItem {
  id: string;
  slug: string;
  name: string;
  status: AdminProductStatus;
  category: { id: string; name: string };
  image: { url: string; altText: string } | null;
  producerCount: number;
  variantCount: number;
  priceFrom: number | null;
  totalOnHandGrams: number;
  updatedAt: string;
}

export interface AdminProductListResponse {
  items: AdminProductListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminProductVariant {
  id: string;
  weightOptionId: string;
  weightLabel: string;
  grams: number;
  price: number;
  sku: string;
  isActive: boolean;
  availablePackages: number;
}

export interface AdminProductProducerLink {
  id: string;
  producerId: string;
  producerName: string;
  isDefault: boolean;
  onHandGrams: number;
  reservedGrams: number;
  lowStockThresholdGrams: number | null;
  variants: AdminProductVariant[];
}

export interface AdminProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: AdminProductStatus;
  type: "SIMPLE" | "BUNDLE";
  harvestSeason: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  category: { id: string; slug: string; name: string };
  images: { id: string; url: string; altText: string; sortOrder: number }[];
  weightOptions: { id: string; label: string; grams: number; sortOrder: number }[];
  producers: AdminProductProducerLink[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductFormOptions {
  categories: { id: string; name: string; slug: string; status: string }[];
  producers: { id: string; name: string; slug: string; region: string; status: string }[];
}

// ---- Payload shapes for create/update — mirror the API's nested DTOs.
// A field left `undefined` on update means "leave unchanged"; the three
// array fields, when present, are a full replacement set for that
// relation (see AdminProductsService docblock on the backend).
export interface AdminProductMediaInput {
  id?: string;
  url: string;
  altText: string;
  sortOrder?: number;
}

export interface AdminWeightOptionInput {
  id?: string;
  label: string;
  grams: number;
  sortOrder?: number;
}

export interface AdminVariantInput {
  id?: string;
  weightOptionId: string;
  price: number;
  sku?: string;
  isActive?: boolean;
}

export interface AdminProductProducerInput {
  id?: string;
  producerId: string;
  isDefault?: boolean;
  onHandGrams?: number;
  lowStockThresholdGrams?: number;
  variants: AdminVariantInput[];
}

export interface CreateProductPayload {
  slug: string;
  name: string;
  description?: string;
  categoryId: string;
  type?: "SIMPLE" | "BUNDLE";
  harvestSeason?: string;
  metaTitle?: string;
  metaDescription?: string;
  weightOptions: AdminWeightOptionInput[];
  producers: AdminProductProducerInput[];
  media?: AdminProductMediaInput[];
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export const adminProductsApi = {
  list: (params: { page?: number; pageSize?: number; status?: AdminProductStatus; categoryId?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.status) qs.set("status", params.status);
    if (params.categoryId) qs.set("categoryId", params.categoryId);
    if (params.q) qs.set("q", params.q);
    const query = qs.toString();
    return apiFetch<AdminProductListResponse>(`/admin/products${query ? `?${query}` : ""}`);
  },
  get: (productId: string) => apiFetch<AdminProductDetail>(`/admin/products/${productId}`),
  formOptions: () => apiFetch<AdminProductFormOptions>(`/admin/products/form-options`),
  create: (payload: CreateProductPayload) =>
    apiFetch<AdminProductDetail>(`/admin/products`, { method: "POST", body: JSON.stringify(payload) }),
  update: (productId: string, payload: UpdateProductPayload) =>
    apiFetch<AdminProductDetail>(`/admin/products/${productId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  setStatus: (productId: string, status: "ACTIVE" | "DRAFT") =>
    apiFetch<AdminProductDetail>(`/admin/products/${productId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
