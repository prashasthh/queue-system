"use client";
import { useState } from "react";
import { api, Notice } from "../ui/common";
import type { Order } from "@/types";
import type { PaymentRecord } from "@/lib/payments/provider";
type Result = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  prefill: { name: string; contact: string };
  handler: (result: Result) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};
declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => {
      open(): void;
      on(event: string, cb: () => void): void;
    };
  }
}
export async function loadCheckout() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(
        new Error("Could not load Razorpay. Check your connection and retry."),
      );
    };
    document.head.appendChild(script);
  });
}
export function RazorpayButton({
  order,
  keyId,
  onPaid,
}: {
  order: Order;
  keyId: string;
  onPaid: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Notice message={error} />
      <button
        className="btn mt-6 w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await loadCheckout();
            const p = await api<PaymentRecord>(`/api/payments/${order.id}`, {});
            if (!window.Razorpay || p.provider !== "razorpay")
              throw new Error(
                "Payment configuration changed. Reload this page.",
              );
            const checkout = new window.Razorpay({
              key: keyId,
              order_id: p.provider_order_id,
              amount: p.amount,
              currency: "INR",
              name: "Demo Restaurant",
              prefill: { name: order.name, contact: order.phone },
              theme: { color: "#b84f30" },
              handler: async (result) => {
                try {
                  await api(`/api/payments/${order.id}/verify`, result);
                  localStorage.removeItem(`cart:${order.queue_entry_id}`);
                  localStorage.removeItem(`checkout:${order.queue_entry_id}`);
                  await onPaid();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              },
              modal: {
                ondismiss: () => {
                  setBusy(false);
                  setError(
                    "Checkout closed. Your order is saved; you can retry payment.",
                  );
                },
              },
            });
            checkout.on("payment.failed", () => {
              setBusy(false);
              setError(
                "Payment failed. Please retry using another payment method.",
              );
            });
            checkout.open();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Connecting securely…" : "Pay with Razorpay"}
      </button>
    </>
  );
}
