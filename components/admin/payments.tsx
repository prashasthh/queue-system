"use client";
import { useState } from "react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import { money } from "@/lib/utils/format";
type Metrics = {
  gross_sales: number;
  net_sales: number;
  online_payments: number;
  cash_payments: number;
  total_orders: number;
  refunds: number;
  discounts: number;
  manual_discounts: number;
  vip_discounts: number;
  personalized_discounts: number;
  average_order_value: number;
  vip_fees: number;
  commitment_deposits: number;
};
type Payment = {
  id: string;
  order_id: string | null;
  amount: number;
  status: string;
  method: string;
  purpose: string;
  provider: string;
  customer_name: string | null;
  created_at: string;
  discount_amount: number | null;
};
type Outstanding = {
  id: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  discount_reason: string;
  customer_name: string;
  created_at: string;
};
type Refund = {
  id: string;
  payment_id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
};
type Data = {
  metrics: Metrics;
  payments: Payment[];
  refunds: Refund[];
  outstanding: Outstanding[];
};
const localDate = (d = new Date()) =>
  d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export function PaymentsDashboard() {
  const [from, setFrom] = useState(localDate()),
    [to, setTo] = useState(localDate()),
    { data, error, refresh } = useData<Data>(
      `/api/admin/payments?from=${from}&to=${to}`,
    ),
    [failure, setFailure] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [discounting, setDiscounting] = useState<string | null>(null);
  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setFailure("");
    try {
      await api("/api/admin/payments", payload);
      setMessage("Payment records updated");
      await refresh();
      return true;
    } catch (e) {
      setFailure((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function range(kind: "today" | "week" | "month") {
    const end = new Date(),
      start = new Date(end);
    if (kind === "week") start.setDate(end.getDate() - 6);
    if (kind === "month") start.setDate(1);
    setFrom(localDate(start));
    setTo(localDate(end));
  }
  const cards: [keyof Metrics, string][] = [
    ["gross_sales", "Gross sales"],
    ["net_sales", "Net sales"],
    ["online_payments", "Online"],
    ["cash_payments", "Cash"],
    ["total_orders", "Paid orders"],
    ["refunds", "Refunds"],
    ["discounts", "All discounts"],
    ["personalized_discounts", "Personalized"],
    ["vip_discounts", "VIP discounts"],
    ["manual_discounts", "Manual discounts"],
    ["average_order_value", "Average order"],
    ["vip_fees", "VIP fees"],
    ["commitment_deposits", "Commitment"],
  ];
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="serif text-4xl">Payments</h1>
          <p className="mt-2 text-stone-500">
            Sales, cash collection, discounts and immutable refund history.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            className="rounded-lg border p-2 text-xs"
            onClick={() => range("today")}
          >
            Today
          </button>
          <button
            className="rounded-lg border p-2 text-xs"
            onClick={() => range("week")}
          >
            This week
          </button>
          <button
            className="rounded-lg border p-2 text-xs"
            onClick={() => range("month")}
          >
            This month
          </button>
          <input
            className="field-control !w-auto"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            className="field-control !w-auto"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>
      <Notice message={failure || error} />
      <Notice success message={message} />
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="my-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {cards.map(([key, label]) => (
              <div className="panel" key={key}>
                <p className="text-xs text-stone-500">{label}</p>
                <p className="serif mt-2 text-2xl">
                  {key === "total_orders"
                    ? data.metrics[key]
                    : money(data.metrics[key])}
                </p>
              </div>
            ))}
          </div>
          <h2 className="mb-3 text-xl font-semibold">Outstanding orders</h2>
          <div className="mb-8 grid gap-3 lg:grid-cols-2">
            {data.outstanding.map((o) => (
              <article className="panel" key={o.id}>
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{o.customer_name}</p>
                    <p className="text-xs text-stone-500">
                      Order {o.id.slice(0, 8).toUpperCase()} ·{" "}
                      {money(o.subtotal)} subtotal
                    </p>
                  </div>
                  <b>{money(o.total)}</b>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    className="btn !px-3 !py-2 text-xs"
                    onClick={() => act({ action: "cash", orderId: o.id })}
                  >
                    Mark cash received
                  </button>
                  <button
                    disabled={busy}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    onClick={() =>
                      setDiscounting((current) =>
                        current === o.id ? null : o.id,
                      )
                    }
                  >
                    {o.discount_amount > 0 ? "Edit discount" : "Apply discount"}
                  </button>
                </div>
                {o.discount_amount > 0 && (
                  <p className="mt-3 text-xs text-stone-500">
                    Current discount: {money(o.discount_amount)} ·{" "}
                    {o.discount_reason}
                  </p>
                )}
                {discounting === o.id && (
                  <form
                    className="mt-4 grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget),
                        type = String(form.get("type")),
                        entered = Number(form.get("value")),
                        reason = String(form.get("reason") || "").trim(),
                        value =
                          type === "fixed"
                            ? Math.round(entered * 100)
                            : Math.round(entered);
                      if (!Number.isFinite(value) || value <= 0) {
                        setFailure("Enter a valid discount value");
                        return;
                      }
                      if (type === "percentage" && value > 100) {
                        setFailure("Percentage discount cannot exceed 100%");
                        return;
                      }
                      if (
                        await act({
                          action: "discount",
                          orderId: o.id,
                          type,
                          value,
                          reason,
                        })
                      )
                        setDiscounting(null);
                    }}
                  >
                    <label className="field-label">
                      Discount type
                      <select className="field-control mt-1" name="type">
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed amount (₹)</option>
                      </select>
                    </label>
                    <label className="field-label">
                      Value
                      <input
                        className="field-control mt-1"
                        name="value"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue="10"
                        required
                      />
                    </label>
                    <label className="field-label sm:col-span-2">
                      Reason
                      <input
                        className="field-control mt-1"
                        name="reason"
                        minLength={3}
                        maxLength={200}
                        placeholder="For example: Service recovery"
                        required
                      />
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <button className="btn !px-3 !py-2 text-xs" disabled={busy}>
                        {busy ? "Applying…" : "Apply discount"}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-2 text-xs font-semibold"
                        disabled={busy}
                        onClick={() => setDiscounting(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </article>
            ))}
            {!data.outstanding.length && (
              <p className="panel text-stone-500">
                No outstanding draft orders.
              </p>
            )}
          </div>
          <h2 className="mb-3 text-xl font-semibold">Payment ledger</h2>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  {[
                    "Payment",
                    "Customer / purpose",
                    "Method",
                    "Amount",
                    "Status",
                    "Action",
                  ].map((h) => (
                    <th className="p-4" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr className="border-t border-stone-100" key={p.id}>
                    <td className="p-4 font-mono text-xs">
                      {p.id.slice(0, 8)}
                    </td>
                    <td className="p-4">
                      <p className="font-semibold">
                        {p.customer_name || p.purpose.replaceAll("_", " ")}
                      </p>
                      <p className="text-xs text-stone-500">{p.provider}</p>
                    </td>
                    <td className="p-4 capitalize">{p.method}</td>
                    <td className="p-4 font-semibold">{money(p.amount)}</td>
                    <td className="p-4">
                      <Badge status={p.status} />
                    </td>
                    <td className="p-4">
                      {["paid", "refunded"].includes(p.status) && (
                        <button
                          className="rounded-lg border px-3 py-2 text-xs font-semibold"
                          disabled={busy}
                          onClick={() => {
                            const rupees = prompt(
                                `Refund amount in rupees (max ${p.amount / 100})`,
                                String(p.amount / 100),
                              ),
                              reason = rupees && prompt("Refund reason");
                            if (rupees && reason)
                              void act({
                                action: "refund",
                                paymentId: p.id,
                                amount: Math.round(Number(rupees) * 100),
                                reason,
                              });
                          }}
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.refunds.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-xl font-semibold">
                Refund history
              </h2>
              <div className="grid gap-3">
                {data.refunds.map((r) => (
                  <article
                    className="panel flex justify-between gap-3"
                    key={r.id}
                  >
                    <div>
                      <b>{r.reason}</b>
                      <p className="text-xs text-stone-500">
                        {new Date(r.created_at).toLocaleString("en-IN")} ·
                        Payment {r.payment_id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="text-right">
                      <b>{money(r.amount)}</b>
                      <p>
                        <Badge status={r.status} />
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
