const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class AdminAuthApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AdminAuthApiError";
  }
}

/**
 * Admin API fetch helper. Deliberately its own copy rather than a
 * shared generic with the customer `otp-auth-client.ts` — admin and
 * customer identity are separate security domains end-to-end (backend
 * §6), and that separation is worth keeping visible in the frontend
 * too, not just collapsed into one "authFetch" used for both. Mirrors
 * the same shape: real backend error messages are surfaced (never
 * replaced with a blind generic string), and `credentials: "include"`
 * is required because the admin session cookie is httpOnly — there is
 * no token for this code to read or store, by design.
 */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new AdminAuthApiError("ارتباط با سرور برقرار نشد.");
  }

  if (!res.ok) {
    let message = "عملیات با خطا مواجه شد";
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join("، ") : body.message;
    } catch {
      // keep generic message
    }
    throw new AdminAuthApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export type AdminRole = "OWNER" | "STAFF";

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  lastLoginAt?: string | null;
}

export const adminAuthApi = {
  login: (email: string, password: string) =>
    apiFetch<{ admin: AuthenticatedAdmin }>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => apiFetch<{ loggedOut: true }>("/admin/auth/logout", { method: "POST" }),
};

/**
 * Returns the logged-in admin, or null if there's no active admin
 * session. Never throws for the "not logged in" case — that's an
 * expected, normal outcome (matches `getCurrentCustomer`'s contract).
 */
export async function getCurrentAdmin(): Promise<AuthenticatedAdmin | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    const body = (await res.json()) as { admin: AuthenticatedAdmin };
    return body.admin;
  } catch {
    return null;
  }
}
