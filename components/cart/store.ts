"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
const cartSchema = z.record(z.string().uuid(), z.number().int().min(1).max(20));
export function useCart(id: string) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let saved: Record<string, number> = {};
    try {
      saved = cartSchema.parse(
        JSON.parse(localStorage.getItem(`cart:${id}`) || "{}"),
      );
    } catch {}
    const timer = setTimeout(() => {
      setCart(saved);
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [id]);
  function update(item: string, quantity: number) {
    setCart((previous) => {
      const next = { ...previous };
      if (quantity <= 0) delete next[item];
      else next[item] = Math.min(20, quantity);
      try {
        localStorage.setItem(`cart:${id}`, JSON.stringify(next));
        localStorage.removeItem(`checkout:${id}`);
      } catch {}
      return next;
    });
  }
  return { cart, update, ready };
}
export function checkoutRequest(id: string, cart: Record<string, number>) {
  const fingerprint = JSON.stringify(Object.entries(cart).sort());
  try {
    const stored = JSON.parse(localStorage.getItem(`checkout:${id}`) || "null");
    if (stored?.fingerprint === fingerprint) return stored.requestId as string;
    const requestId = crypto.randomUUID();
    localStorage.setItem(
      `checkout:${id}`,
      JSON.stringify({ fingerprint, requestId }),
    );
    return requestId;
  } catch {
    return crypto.randomUUID();
  }
}
