const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface AddressView {
  id: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  isDefault: boolean;
}

export interface AddressInput {
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  isDefault?: boolean;
}

export class AddressApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AddressApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/addresses${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new AddressApiError("ارتباط با سرور برقرار نشد.");
  }

  if (!res.ok) {
    let message = "عملیات روی آدرس با خطا مواجه شد";
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join("، ") : body.message;
    } catch {
      // keep generic message
    }
    throw new AddressApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const addressApi = {
  list: () => apiFetch<AddressView[]>(""),
  create: (input: AddressInput) => apiFetch<AddressView>("", { method: "POST", body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<void>(`/${id}`, { method: "DELETE" }),
};
