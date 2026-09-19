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

export type AdminCategoryStatus = "ACTIVE" | "HIDDEN";

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  iconKey: string | null;
  sortOrder: number;
  status: AdminCategoryStatus;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCategoryListResponse {
  items: AdminCategory[];
}

export interface CreateCategoryPayload {
  slug: string;
  name: string;
  iconKey?: string;
  sortOrder?: number;
  status?: AdminCategoryStatus;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export const adminCategoriesApi = {
  list: () => apiFetch<AdminCategoryListResponse>(`/admin/categories`),
  get: (categoryId: string) => apiFetch<AdminCategory>(`/admin/categories/${categoryId}`),
  create: (payload: CreateCategoryPayload) =>
    apiFetch<AdminCategory>(`/admin/categories`, { method: "POST", body: JSON.stringify(payload) }),
  update: (categoryId: string, payload: UpdateCategoryPayload) =>
    apiFetch<AdminCategory>(`/admin/categories/${categoryId}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
