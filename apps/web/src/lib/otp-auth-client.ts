const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/auth${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new AuthApiError("ارتباط با سرور برقرار نشد.");
  }

  if (!res.ok) {
    let message = "عملیات با خطا مواجه شد";
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join("، ") : body.message;
    } catch {
      // keep generic message
    }
    throw new AuthApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export const authApi = {
  requestOtp: (phone: string) => apiFetch<{ sent: true }>("/otp/request", { method: "POST", body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string) =>
    apiFetch<{ customer: { id: string; phone: string; fullName: string | null } }>("/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
  logout: () => apiFetch<{ loggedOut: true }>("/logout", { method: "POST" }),
};
