const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type SupportedPaymentMethod = "CARD_TO_CARD" | "SHEBA";

export interface ShippingAddressInput {
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
}

export interface CheckoutInput {
  shippingAddress: ShippingAddressInput;
  paymentMethod: SupportedPaymentMethod;
  guestPhone?: string;
  guestEmail?: string;
  idempotencyKey: string;
}

export interface OrderItemView {
  id: string;
  productNameSnapshot: string;
  producerNameSnapshot: string;
  weightLabelSnapshot: string;
  packagingNameSnapshot: string | null;
  unitPriceSnapshot: number;
  packagingPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  createdAt: string;
  items: OrderItemView[];
}

export interface CheckoutResponse {
  order: OrderView;
  paymentInstructions?: string;
  redirectUrl?: string;
}

export class CheckoutApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "CheckoutApiError";
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
    throw new CheckoutApiError("ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.");
  }

  if (!res.ok) {
    let message = "ثبت سفارش با خطا مواجه شد";
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join("، ") : body.message;
      }
    } catch {
      // Response body wasn't JSON — keep the generic message.
    }
    throw new CheckoutApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export const checkoutApi = {
  submit: (input: CheckoutInput) =>
    apiFetch<CheckoutResponse>("/checkout", { method: "POST", body: JSON.stringify(input) }),
  getOrder: (orderId: string) => apiFetch<OrderView>(`/orders/${orderId}`),
  listMyOrders: () => apiFetch<OrderView[]>("/orders"),
};
