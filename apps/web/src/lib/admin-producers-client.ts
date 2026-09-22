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

export type AdminProducerStatus = "ACTIVE" | "HIDDEN";

export interface AdminProducer {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  region: string;
  province: string;
  verified: boolean;
  status: AdminProducerStatus;
  photo: { url: string; altText: string } | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProducerListResponse {
  items: AdminProducer[];
}

export interface CreateProducerPayload {
  slug: string;
  name: string;
  bio?: string;
  region: string;
  province: string;
  verified?: boolean;
  status?: AdminProducerStatus;
  /** Omit entirely on create to leave photo-less; pass an object to set one immediately. */
  photo?: { url: string; altText: string };
}

/**
 * Not `Partial<CreateProducerPayload>` — `photo` needs a third state
 * beyond "provide an object" / "omit the key" that Partial<> alone
 * can't express: explicit removal via `photo: null`. See
 * ProducerPhotoInputDto's doc comment on the backend for the exact
 * three-state contract this mirrors (omitted = unchanged, null =
 * remove, object = upsert).
 */
export type UpdateProducerPayload = Partial<Omit<CreateProducerPayload, "photo">> & {
  photo?: { url: string; altText: string } | null;
};

export const adminProducersApi = {
  list: () => apiFetch<AdminProducerListResponse>(`/admin/producers`),
  get: (producerId: string) => apiFetch<AdminProducer>(`/admin/producers/${producerId}`),
  create: (payload: CreateProducerPayload) =>
    apiFetch<AdminProducer>(`/admin/producers`, { method: "POST", body: JSON.stringify(payload) }),
  update: (producerId: string, payload: UpdateProducerPayload) =>
    apiFetch<AdminProducer>(`/admin/producers/${producerId}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
