"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import type { Order } from "@/types";
import { money } from "@/lib/utils/format";
export function OrderSummary({ order: o }: { order: Order }) {
  return (
    <div className="panel receipt-card">
      <div className="mb-6 flex items-start justify-between border-b border-stone-100 pb-6">
        <div>
          <p className="font-semibold">{o.name}</p>
          <p className="mt-1 text-xs text-stone-500">
            {o.phone} · Queue {o.queue_number}
          </p>
        </div>
        <Badge status={o.payment_status} />
      </div>
      <div className="space-y-5">
        {o.items.map((i) => (
          <div
            key={i.menu_item_id}
            className="flex justify-between gap-4 text-sm"
          >
            <div>
              <p className="font-medium">{i.name}</p>
              <p className="mt-1 text-xs text-stone-500">
                {i.quantity} × {money(i.unit_price)}
              </p>
            </div>
            <span>{money(i.total_price)}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3 border-t border-dashed border-stone-200 pt-5">
        <div className="flex justify-between text-sm text-stone-500">
          <span>Subtotal</span>
          <span>{money(o.subtotal)}</span>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <span>Discount {o.discount_reason}</span>
          <span>−{money(o.discount_amount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Commitment credit</span>
          <span>−{money(o.credit_applied)}</span>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{money(o.total)}</span>
        </div>
        <p className="text-xs text-stone-400">
          Inclusive pricing · No additional charges
        </p>
      </div>
    </div>
  );
}
export function Review({ id }: { id: string }) {
  const { data: o, error } = useData<Order>(`/api/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const router = useRouter();
  return (
    <>
      <p className="eyebrow text-brand">One last look</p>
      <h1 className="serif my-4 text-4xl">Everything look delicious?</h1>
      <p className="mb-8 text-stone-500">
        Review your items and quantities before you pay.
      </p>
      <Notice message={error || failure} />
      {!o ? (
        <Loading error={error} />
      ) : (
        <>
          <OrderSummary order={o} />
          {o.payment_status === "paid" ? (
            <Link className="btn mt-6 w-full" href={`/payment/${id}`}>
              View paid order
            </Link>
          ) : (
            <>
              <button
                className="btn mt-6 w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/api/orders/${id}/review`, {});
                    router.push(`/payment/${id}`);
                  } catch (e) {
                    setFailure((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? "Saving review…"
                  : `Proceed to payment · ${money(o.total)}`}
              </button>
              <button
                className="mt-5 block text-center text-sm underline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/api/orders/${id}/cancel`, {});
                    localStorage.removeItem(`checkout:${o.queue_entry_id}`);
                    router.push(`/cart/${o.queue_entry_id}`);
                  } catch (e) {
                    setFailure((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                Edit order
              </button>
            </>
          )}
        </>
      )}
    </>
  );
}
