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

export interface AdminPackagingOption {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface CreatePackagingOptionPayload {
  name: string;
  priceDelta?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export type UpdatePackagingOptionPayload = Partial<CreatePackagingOptionPayload>;

export const adminPackagingOptionsApi = {
  list: () => apiFetch<AdminPackagingOption[]>(`/admin/packaging-options`),
  get: (id: string) => apiFetch<AdminPackagingOption>(`/admin/packaging-options/${id}`),
  create: (payload: CreatePackagingOptionPayload) =>
    apiFetch<AdminPackagingOption>(`/admin/packaging-options`, { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: UpdatePackagingOptionPayload) =>
    apiFetch<AdminPackagingOption>(`/admin/packaging-options/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
