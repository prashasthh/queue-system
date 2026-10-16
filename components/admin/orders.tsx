"use client";
import { useState } from "react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import type { Order } from "@/types";
import { money, time } from "@/lib/utils/format";
export function Orders() {
  const { data, error, refresh } = useData<Order[]>("/api/admin/orders", 4000);
  const [busy, setBusy] = useState("");
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <>
      <p className="eyebrow text-brand">From the dining room to the kitchen</p>
      <h1 className="serif my-4 text-4xl">Every order, in order.</h1>
      <p className="mb-8 text-sm text-stone-500">
        Latest 100 orders · Paid orders move from confirmed to preparing, ready
        and completed.
      </p>
      <Notice message={error || failure} />
      <Notice message={notice} success />
      {!data ? (
        <Loading error={error} />
      ) : !data.length ? (
        <div className="panel text-stone-500">
          No orders yet. Your guests’ first orders will appear here.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.map((o) => (
            <article key={o.id} className="panel">
              <div className="flex justify-between gap-4">
                <div>
                  <p className="eyebrow text-stone-400">
                    #{o.id.slice(0, 8).toUpperCase()} · {time(o.created_at)}
                  </p>
                  <h2 className="mt-3 font-semibold">
                    {o.name}{" "}
                    <span className="font-normal text-stone-400">
                      / {o.queue_number}
                    </span>
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">{o.phone}</p>
                </div>
                <span className="font-semibold">{money(o.total)}</span>
              </div>
              <div className="my-5 space-y-2 border-y border-stone-100 py-4">
                {o.items.map((i) => (
                  <p
                    className="flex justify-between text-sm"
                    key={i.menu_item_id}
                  >
                    <span>
                      {i.quantity} × {i.name}
                    </span>
                    <span className="text-stone-500">
                      {money(i.total_price)}
                    </span>
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Badge status={o.payment_status} />
                  <Badge status={o.status} />
                </div>
                {o.payment_status === "paid" &&
                  ["confirmed", "preparing", "ready"].includes(o.status) && (
                    <button
                      className="btn btn-secondary !py-2"
                      disabled={busy === o.id}
                      onClick={async () => {
                        setBusy(o.id);
                        setFailure("");
                        const status = {
                          confirmed: "preparing",
                          preparing: "ready",
                          ready: "completed",
                        }[o.status as "confirmed" | "preparing" | "ready"];
                        try {
                          await api(
                            `/api/admin/orders/${o.id}`,
                            { status },
                            "PATCH",
                          );
                          setNotice(
                            `Order ${o.id.slice(0, 8)} marked ${status}`,
                          );
                          await refresh();
                        } catch (e) {
                          setFailure((e as Error).message);
                        } finally {
                          setBusy("");
                        }
                      }}
                    >
                      {busy === o.id
                        ? "Updating…"
                        : {
                            confirmed: "Start preparing",
                            preparing: "Mark ready",
                            ready: "Complete order",
                          }[o.status as "confirmed" | "preparing" | "ready"]}
                    </button>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
