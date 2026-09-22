const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface CartItemView {
  id: string;
  variantId: string;
  productSlug: string;
  productName: string;
  producerName: string;
  weightLabel: string;
  grams: number;
  image: { url: string; altText: string } | null;
  packagingOptionId: string | null;
  packagingName: string | null;
  packagingPriceDelta: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availablePackages: number;
  hasAvailabilityIssue: boolean;
}

export interface CartView {
  id: string;
  items: CartItemView[];
  itemCount: number;
  subtotal: number;
  total: number;
}

export class CartApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "CartApiError";
  }
}

async function cartFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/cart${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new CartApiError("ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.");
  }

  if (!res.ok) {
    // The API's global exception filter always returns { message, ... } —
    // surface that real message rather than a generic one where possible.
    let message = "خطایی در سبد خرید رخ داد";
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join("، ") : body.message;
      }
    } catch {
      // Response body wasn't JSON — keep the generic message.
    }
    throw new CartApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export const cartApi = {
  get: () => cartFetch<CartView>(""),
  addItem: (input: { variantId: string; packagingOptionId?: string; quantity?: number }) =>
    cartFetch<CartView>("/items", { method: "POST", body: JSON.stringify(input) }),
  updateItemQuantity: (itemId: string, quantity: number) =>
    cartFetch<CartView>(`/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
  removeItem: (itemId: string) => cartFetch<CartView>(`/items/${itemId}`, { method: "DELETE" }),
  clear: () => cartFetch<CartView>("", { method: "DELETE" }),
};
