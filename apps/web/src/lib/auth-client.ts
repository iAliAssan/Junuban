const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface AuthenticatedCustomer {
  id: string;
  phone: string;
  fullName: string | null;
}

/** Returns the logged-in customer, or null if there's no active session. Never throws for the "not logged in" case — that's an expected, normal outcome. */
export async function getCurrentCustomer(): Promise<AuthenticatedCustomer | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    const body = (await res.json()) as { customer: AuthenticatedCustomer };
    return body.customer;
  } catch {
    return null;
  }
}
