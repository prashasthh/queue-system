"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, Loading, Notice, useData } from "../ui/common";
import { useCart, checkoutRequest } from "./store";
import type { MenuItem, Order } from "@/types";
import { money } from "@/lib/utils/format";
export function Cart({ id }: { id: string }) {
  const { data: items, error } = useData<MenuItem[]>(`/api/menu/${id}`);
  const { cart, update, ready } = useCart(id);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const selected = items?.filter((m) => cart[m.id]) || [];
  const total = selected.reduce((sum, m) => sum + cart[m.id] * m.price, 0);
  return (
    <>
      <p className="eyebrow text-brand">Your favourites, all together</p>
      <h1 className="serif my-4 text-4xl">Your cart.</h1>
      <Notice message={error || failure} />
      {!items || !ready ? (
        <Loading error={error} />
      ) : !selected.length ? (
        <div className="panel my-8">
          <p className="mb-5 text-stone-500">
            Your cart is waiting for something delicious.
          </p>
          <Link className="btn" href={`/menu/${id}`}>
            Explore menu
          </Link>
        </div>
      ) : (
        <>
          <div className="panel my-8 divide-y divide-stone-100">
            {selected.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-4 py-5 first:pt-0 last:pb-0"
              >
                <div>
                  <h2 className="font-semibold">{m.name}</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {money(m.price)} each{" "}
                    {!m.available && "· No longer available"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    aria-label={`Decrease ${m.name}`}
                    className="rounded-lg border px-3 py-1"
                    onClick={() => update(m.id, cart[m.id] - 1)}
                  >
                    −
                  </button>
                  <span>{cart[m.id]}</span>
                  <button
                    aria-label={`Increase ${m.name}`}
                    disabled={cart[m.id] >= 20 || !m.available}
                    className="rounded-lg border px-3 py-1"
                    onClick={() => update(m.id, cart[m.id] + 1)}
                  >
                    +
                  </button>
                  <button
                    className="text-xs text-brand underline"
                    onClick={() => update(m.id, 0)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mb-7 flex justify-between text-xl font-semibold">
            <span>Subtotal</span>
            <span>{money(total)}</span>
          </div>
          <p className="mb-6 text-xs text-stone-500">
            All prices inclusive. No additional charges in this demo.
          </p>
          <button
            className="btn w-full"
            disabled={busy || selected.some((m) => !m.available)}
            onClick={async () => {
              setBusy(true);
              try {
                const order = await api<Order>("/api/orders", {
                  queueEntryId: id,
                  requestId: checkoutRequest(id, cart),
                  items: Object.entries(cart).map(([menuItemId, quantity]) => ({
                    menuItemId,
                    quantity,
                  })),
                });
                router.push(`/checkout/${order.id}`);
              } catch (e) {
                setFailure((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {busy ? "Preparing your review…" : "Review order →"}
          </button>
          <Link
            className="mt-5 block text-center text-sm text-stone-500 underline"
            href={`/menu/${id}`}
          >
            Add more items
          </Link>
        </>
      )}
    </>
  );
}
