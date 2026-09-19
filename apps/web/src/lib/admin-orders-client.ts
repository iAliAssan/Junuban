import type { OrderView } from "./checkout-client";

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

export type OrderStatusFilter =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

// `OrderView` (from checkout-client.ts) is reused as-is, deliberately —
// the admin endpoints return the exact same `ORDER_INCLUDE` shape as
// the customer-facing order lookup on the backend (same OrdersService,
// same include), so a parallel type here would just drift out of sync.
export type AdminOrderView = OrderView & { customerId?: string | null };

export interface AdminOrderListResponse {
  items: AdminOrderView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  admin: { id: string; fullName: string; email: string };
}

export interface ActivityLogListResponse {
  items: ActivityLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export const adminApi = {
  listOrders: (params: { page?: number; pageSize?: number; status?: OrderStatusFilter } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.status) qs.set("status", params.status);
    const query = qs.toString();
    return apiFetch<AdminOrderListResponse>(`/admin/orders${query ? `?${query}` : ""}`);
  },
  getOrder: (orderId: string) => apiFetch<AdminOrderView>(`/admin/orders/${orderId}`),
  markOrderPaid: (orderId: string) =>
    apiFetch<AdminOrderView>(`/admin/orders/${orderId}/mark-paid`, { method: "POST" }),
  // Statuses accepted by this route: PROCESSING/SHIPPED/DELIVERED/CANCELLED/REFUNDED.
  // PAID goes through markOrderPaid instead (see SetOrderStatusDto on the backend
  // for why — it also confirms the matching payment attempt, which this must not skip).
  setOrderStatus: (
    orderId: string,
    status: Exclude<OrderStatusFilter, "PENDING_PAYMENT" | "PAID">,
    note?: string,
  ) =>
    apiFetch<AdminOrderView>(`/admin/orders/${orderId}/status`, {
      method: "POST",
      body: JSON.stringify({ status, note }),
    }),
  // Owner-only on the backend (AdminOwnerGuard) — a STAFF admin calling
  // this will get a real 403 from the API, which the UI must show as an
  // error rather than assume success or silently hide the failure.
  listActivityLog: (params: { page?: number; pageSize?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString();
    return apiFetch<ActivityLogListResponse>(`/admin/activity-log${query ? `?${query}` : ""}`);
  },
};
