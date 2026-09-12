"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cartApi, CartApiError, type CartView } from "@/lib/cart-client";

interface CartContextValue {
  cart: CartView | null;
  /** 'idle' = not yet fetched, 'loading' = fetch/mutation in flight, 'ready' = loaded successfully, 'error' = the load itself failed. */
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** Set only on the most recent mutation attempt, cleared on the next successful one — separate from `error` so a failed "add" doesn't blank out an already-loaded cart. */
  mutationError: string | null;
  refresh: () => Promise<void>;
  addItem: (input: { variantId: string; packagingOptionId?: string; quantity?: number }) => Promise<boolean>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [status, setStatus] = useState<CartContextValue["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const result = await cartApi.get();
      setCart(result);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof CartApiError ? err.message : "بارگذاری سبد خرید با خطا مواجه شد");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Runs a mutation, refreshing cart state on success and surfacing a real message on failure. Never simulates success. */
  async function runMutation(fn: () => Promise<CartView>): Promise<boolean> {
    setMutationError(null);
    try {
      const result = await fn();
      setCart(result);
      setStatus("ready");
      return true;
    } catch (err) {
      setMutationError(err instanceof CartApiError ? err.message : "عملیات با خطا مواجه شد");
      return false;
    }
  }

  const addItem: CartContextValue["addItem"] = (input) => runMutation(() => cartApi.addItem(input));
  const updateItemQuantity: CartContextValue["updateItemQuantity"] = (itemId, quantity) =>
    runMutation(() => cartApi.updateItemQuantity(itemId, quantity));
  const removeItem: CartContextValue["removeItem"] = (itemId) => runMutation(() => cartApi.removeItem(itemId));
  const clearCart: CartContextValue["clearCart"] = () => runMutation(() => cartApi.clear());

  return (
    <CartContext.Provider
      value={{ cart, status, error, mutationError, refresh, addItem, updateItemQuantity, removeItem, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
