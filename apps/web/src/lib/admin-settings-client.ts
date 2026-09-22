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

export interface AdminPaymentSettings {
  cardToCardNumber: string | null;
  cardToCardHolderName: string | null;
  cardToCardBankName: string | null;
  shebaIban: string | null;
  shebaHolderName: string | null;
  paymentInstructions: string | null;
  paymentCardPhoto: { url: string; altText: string } | null;
}

export interface UpdatePaymentSettingsPayload {
  cardToCardNumber?: string;
  cardToCardHolderName?: string;
  cardToCardBankName?: string;
  shebaIban?: string;
  shebaHolderName?: string;
  paymentInstructions?: string;
  paymentCardPhoto?: { url: string; altText: string } | null;
}

export const adminSettingsApi = {
  getPaymentSettings: () => apiFetch<AdminPaymentSettings>(`/admin/settings/payment`),
  updatePaymentSettings: (payload: UpdatePaymentSettingsPayload) =>
    apiFetch<AdminPaymentSettings>(`/admin/settings/payment`, { method: "PATCH", body: JSON.stringify(payload) }),
};
