"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import { money } from "@/lib/utils/format";
import type {
  PriorityOffer,
  PriorityPurchase,
  VisitKind,
} from "@/lib/priority/service";
import { loadCheckout } from "../cart/razorpay-button";
import type { PaymentRecord } from "@/lib/payments/provider";
export function PriorityOptions({ kind, id }: { kind: VisitKind; id: string }) {
  const { data, error } = useData<PriorityOffer>(
      `/api/priority?kind=${kind}&id=${id}`,
    ),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false),
    router = useRouter();
  return (
    <>
      <Notice message={error || failure} />
      {!data ? (
        <Loading error={error} />
      ) : !data.eligible ? (
        <>
          <div className="panel my-5">
            <p className="eyebrow">
              Visit status · {data.status.replaceAll("_", " ")}
            </p>
            <h1 className="serif my-4 text-4xl">
              {data.paidPriority
                ? "Your fast-track is active."
                : kind === "queue" && data.status === "called"
                  ? "Your table is already being prepared."
                  : "Priority is no longer needed."}
            </h1>
            <p className="text-stone-500">
              {data.paidPriority
                ? `Your ${data.paidPriority} priority payment moved you ahead and the restaurant has already called you.`
                : kind === "queue" && data.status === "called"
                  ? "You have already been called, so there is no waiting queue left to skip and no fast-track payment is needed. You can still compare the options below."
                  : "Priority can only be purchased before your visit moves past its waiting stage. You can still compare the options below."}
            </p>
          </div>
          <h2 className="serif mb-4 mt-8 text-3xl">Priority options</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {data.options.map((p) => (
              <article className="panel" key={p.type}>
                <h3 className="serif text-3xl capitalize">
                  {p.type} priority
                </h3>
                <p className="my-4 text-2xl">{money(p.amount)}</p>
                <p className="mb-5 text-stone-500">
                  {p.type === "vip"
                    ? `Fast-track seating plus ${p.discount}% off your food bill. The priority fee is separate from your food bill and is not used as credit.`
                    : `Fast-track seating with the full deposit credited toward your food bill. ${p.policy === "retain_minimum" ? "Unused credit is retained as a minimum spend." : "Unused credit is refundable through staff after your visit."}`}
                </p>
                <button className="btn" disabled>
                  Unavailable · visit {data.status.replaceAll("_", " ")}
                </button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <h1 className="serif my-5 text-4xl">
            {kind === "queue" ? "Skip the normal queue." : "Choose your priority."}
          </h1>
          <p className="mb-6 text-stone-500">
            {kind === "queue"
              ? "Pay upfront to move ahead of the free waiting queue. If a suitable table is available, we’ll call you immediately; otherwise you’ll be first among eligible parties for the next one."
              : "Pay upfront for priority handling when you arrive. Your reservation time and a suitable table still determine seating."}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {data.options.map((p) => (
              <article className="panel" key={p.type}>
                <h2 className="serif text-3xl capitalize">{p.type} priority</h2>
                <p className="my-4 text-2xl">{money(p.amount)}</p>
                <p className="mb-5 text-stone-500">
                  {p.type === "vip"
                    ? `Fast-track seating plus ${p.discount}% off your food bill. The priority fee is separate from your food bill.`
                    : `Fast-track seating with this deposit credited toward your food bill. ${p.policy === "retain_minimum" ? "Unused credit is retained as a minimum spend." : "Unused credit is refundable through staff after your visit."}`}
                </p>
                <button
                  className="btn"
                  disabled={busy || p.amount <= 0}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const purchase = await api<PriorityPurchase>(
                        "/api/priority",
                        { kind, id, type: p.type },
                      );
                      router.push(`/priority/review/${purchase.id}`);
                    } catch (e) {
                      setFailure((e as Error).message);
                      setBusy(false);
                    }
                  }}
                >
                  Review {p.type}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {data &&
      !data.eligible &&
      ["completed", "cancelled"].includes(data.status) ? (
        <Link className="btn mt-6" href={`/r/${data.restaurantSlug}`}>
          Start a new visit →
        </Link>
      ) : (
        <Link className="mt-6 block underline" href={`/${kind}/${id}`}>
          {data && !data.eligible
            ? "Back to your current visit"
            : kind === "queue"
              ? "Continue with the free standard queue"
              : "Continue with the standard reservation"}
        </Link>
      )}
    </>
  );
}
export function PriorityReview({ id }: { id: string }) {
  const { data, error, refresh } = useData<{
      purchase: PriorityPurchase;
      provider: string;
      keyId: string;
    }>(`/api/priority/${id}`, 4000),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  async function action(action: string, success?: boolean) {
    setBusy(true);
    setFailure("");
    try {
      await api(`/api/priority/${id}`, {
        action,
        ...(success === undefined ? {} : { success }),
      });
      await refresh();
      if (success === false)
        setFailure("Payment failed. No money was charged; please retry.");
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <>
        <Notice message={error} />
        <Loading error={error} />
      </>
    );
  const p = data.purchase;
  return (
    <>
      <h1 className="serif my-5 text-4xl">Review your priority</h1>
      <Notice message={failure || error} />
      <div className="panel space-y-4">
        <p className="eyebrow">{p.restaurant_name}</p>
        <p>
          {p.name} · {p.phone}
        </p>
        <Badge status={p.payment_status} />
        <h2 className="text-xl capitalize">
          {p.priority_type} priority{" "}
          {p.priority_type === "vip" ? "fee" : "deposit"}
        </h2>
        <p>
          {p.priority_type === "vip"
            ? `After payment, you move ahead of the normal queue and receive ${p.discount_percentage}% off food. The priority fee is not bill credit.`
            : `After payment, you move ahead of the normal queue and this deposit becomes food bill credit. ${p.commitment_policy === "retain_minimum" ? "The restaurant retains the minimum commitment if you spend less." : "Ask staff to refund unused credit after completing your visit."}`}
        </p>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(p.amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Additional tax / discount / credit</span>
          <span>₹0</span>
        </div>
        <div className="flex justify-between text-xl font-bold">
          <span>Total payable</span>
          <span>{money(p.amount)}</span>
        </div>
        {p.payment_status === "paid" && p.priority_type === "commitment" && (
          <p>
            Credit used/reserved: {money(p.credit_used)} · balance:{" "}
            {money(p.amount - p.credit_used)}
          </p>
        )}
      </div>
      {p.payment_status === "paid" ? (
        <Link
          className="btn mt-6"
          href={
            p.queue_entry_id
              ? `/queue/${p.queue_entry_id}`
              : `/reservation/${p.reservation_id}`
          }
        >
          Back to your visit
        </Link>
      ) : !p.reviewed_at ? (
        <button
          className="btn mt-6"
          disabled={busy}
          onClick={() => action("review")}
        >
          Confirm review and continue to payment
        </button>
      ) : data.provider === "mock" ? (
        <div className="panel mt-5">
          <p className="mb-4">Mock payment · no real money charged</p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => action("mock", true)}
          >
            Simulate successful payment
          </button>
          <button
            className="btn btn-secondary ml-3 mt-3"
            disabled={busy}
            onClick={() => action("mock", false)}
          >
            Simulate failed payment
          </button>
        </div>
      ) : (
        <button
          className="btn mt-6"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setFailure("");
            try {
              await loadCheckout();
              const payment = await api<PaymentRecord>(`/api/priority/${id}`, {
                action: "start",
              });
              if (!window.Razorpay) throw new Error("Checkout unavailable");
              new window.Razorpay({
                key: data.keyId,
                order_id: payment.provider_order_id,
                amount: payment.amount,
                currency: "INR",
                name: p.restaurant_name,
                prefill: { name: p.name, contact: p.phone },
                theme: { color: "#79503e" },
                modal: { ondismiss: () => setBusy(false) },
                handler: async (result) => {
                  try {
                    await api(`/api/priority/${id}`, {
                      action: "verify",
                      ...result,
                    });
                    await refresh();
                  } catch (e) {
                    setFailure((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                },
              }).open();
            } catch (e) {
              setFailure((e as Error).message);
              setBusy(false);
            }
          }}
        >
          Pay with Razorpay
        </button>
      )}
      {p.payment_status !== "paid" && (
        <Link
          className="mt-5 block underline"
          href={`/priority/${p.queue_entry_id ? "queue" : "reservation"}/${p.queue_entry_id || p.reservation_id}`}
        >
          Edit priority selection
        </Link>
      )}
    </>
  );
}
