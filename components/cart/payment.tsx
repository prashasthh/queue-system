"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import { OrderSummary } from "./review";
import { RazorpayButton } from "./razorpay-button";
import type { Order } from "@/types";
export function Payment({ id }: { id: string }) {
  const { data: o, error, refresh } = useData<Order>(`/api/orders/${id}`, 4000);
  const { data: config, error: configError } = useData<{
    provider: string;
    keyId: string;
  }>(`/api/payments/${id}`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  async function simulate(result: string) {
    setBusy(true);
    setFailure("");
    try {
      const paid = await api<Order>(`/api/payments/${id}/mock`, { result });
      if (paid.payment_status === "paid") {
        localStorage.removeItem(`cart:${paid.queue_entry_id}`);
        localStorage.removeItem(`checkout:${paid.queue_entry_id}`);
      }
      await refresh();
      if (result === "failed")
        setFailure(
          "Payment wasn’t completed. No money was charged. You can try again.",
        );
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Notice message={error || configError || failure} />
      {!o || !config ? (
        <Loading error={error || configError} />
      ) : o.payment_status === "paid" ? (
        <>
          <div className="mb-8 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-5 text-[#79503e]" />
            <p className="eyebrow text-[#79503e]">Payment successful</p>
            <h1 className="serif my-4 text-4xl">You’re all set.</h1>
            <p className="mb-4 text-stone-500">
              Order #{o.id.slice(0, 8).toUpperCase()} is with the restaurant.
            </p>
            <Badge status={o.status} />
          </div>
          <OrderSummary order={o} />
          <p className="mt-5 text-center text-xs text-stone-500">
            Your confirmation has been queued for WhatsApp. In mock mode, staff
            can view it in Messages.
          </p>
          <Link className="btn mt-6 w-full" href={`/queue/${o.queue_entry_id}`}>
            Back to my visit
          </Link>
        </>
      ) : !o.reviewed_at ? (
        <div className="panel">
          <h1 className="serif mb-4 text-3xl">Review first, then pay.</h1>
          <Link className="btn" href={`/checkout/${id}`}>
            Review order
          </Link>
        </div>
      ) : (
        <>
          <p className="eyebrow text-brand">The final step</p>
          <h1 className="serif my-4 text-4xl">Let’s make it official.</h1>
          <div className="mb-8 flex items-center gap-2 text-sm text-stone-500">
            <ShieldCheck size={17} />
            {config.provider === "mock"
              ? "Demo payment · No real money is charged"
              : "Secure payment with Razorpay"}
          </div>
          <OrderSummary order={o} />
          {o.total === 0 ? (
            <button
              className="btn mt-6 w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/api/payments/${id}/credit`, {});
                  localStorage.removeItem(`cart:${o.queue_entry_id}`);
                  localStorage.removeItem(`checkout:${o.queue_entry_id}`);
                  await refresh();
                } catch (e) {
                  setFailure((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm order using commitment credit
            </button>
          ) : config.provider === "mock" ? (
            <div className="panel mt-6">
              <h2 className="font-semibold">Mock payment sandbox</h2>
              <p className="my-3 text-sm text-stone-500">
                Try both outcomes to test the complete flow.
              </p>
              <button
                className="btn w-full"
                disabled={busy}
                onClick={() => simulate("success")}
              >
                {busy ? "Processing…" : "Simulate successful payment"}
              </button>
              <button
                className="btn btn-secondary mt-3 w-full"
                disabled={busy}
                onClick={() => simulate("failed")}
              >
                Simulate failed payment
              </button>
            </div>
          ) : (
            <RazorpayButton order={o} keyId={config.keyId} onPaid={refresh} />
          )}
          <Link
            className="mt-5 block text-center text-sm underline"
            href={`/checkout/${id}`}
          >
            Back to review
          </Link>
        </>
      )}
    </>
  );
}
