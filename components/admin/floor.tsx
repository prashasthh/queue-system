"use client";
import { useState } from "react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import type { Table } from "@/lib/tables/service";
import type { QueueEntry, QueueStatus } from "@/types";
import { tableTransitions, tableStatuses } from "@/lib/tables/states";
export function FloorDashboard() {
  const { data, error, refresh } = useData<Table[]>("/api/admin/floor", 5000),
    { data: queue } = useData<QueueEntry[]>("/api/admin/queue", 5000),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  async function act(value: unknown) {
    setBusy(true);
    setFailure("");
    try {
      await api("/api/admin/floor", value);
      await refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function updateVisit(id: string, status: QueueStatus) {
    setBusy(true);
    setFailure("");
    try {
      await api(`/api/admin/queue/${id}`, { status }, "PATCH");
      await refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Notice message={error || failure} />
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {["available", "waiting_for_guests", "occupied"].map((s) => (
              <div className="panel" key={s}>
                <Badge status={s} />
                <p className="serif mt-3 text-4xl">
                  {data.filter((t) => t.status === s).length}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.map((t) => (
              <article key={t.id} className="panel">
                <div className="flex justify-between gap-2">
                  <h2 className="serif text-3xl">{t.table_number}</h2>
                  <Badge status={t.status} />
                </div>
                <p className="my-3 text-sm text-stone-500">
                  {t.name} · {t.capacity} seats · {t.floor_section}
                </p>
                {t.customer_name && (
                  <div className="my-4 rounded-xl bg-stone-50 p-3">
                    <p>
                      {t.customer_name} · {t.party_size} guests
                    </p>
                    <p className="text-xs">
                      Since{" "}
                      {new Date(t.assigned_at!).toLocaleTimeString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                      {t.order_status && ` · Order ${t.order_status}`}
                    </p>
                    {t.reservation_id && (
                      <p className="text-xs">Reserved guest</p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {tableTransitions[t.status]
                    .filter(
                      (s) =>
                        !t.queue_entry_id ||
                        !["available", "cleaning", "out_of_service"].includes(
                          s,
                        ),
                    )
                    .map((s) => (
                    <button
                      key={s}
                      disabled={busy}
                      className="btn btn-secondary !px-3 !py-2 !text-xs"
                      onClick={() =>
                        act({ action: "status", id: t.id, status: s })
                      }
                    >
                      {s === "occupied" && t.queue_status === "called"
                        ? "Seat guest"
                        : s.replaceAll("_", " ")}
                    </button>
                    ))}
                  {t.queue_entry_id && t.queue_status === "called" && (
                    <button
                      className="btn btn-secondary !px-3 !py-2 !text-xs"
                      disabled={busy}
                      onClick={() =>
                        void updateVisit(t.queue_entry_id!, "cancelled")
                      }
                    >
                      Cancel visit
                    </button>
                  )}
                  {t.queue_entry_id && t.queue_status === "seated" && (
                    <button
                      className="btn btn-secondary !px-3 !py-2 !text-xs"
                      disabled={busy}
                      onClick={() =>
                        void updateVisit(t.queue_entry_id!, "completed")
                      }
                    >
                      Complete visit
                    </button>
                  )}
                </div>
                {t.status === "available" && (
                  <form
                    className="mt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act({
                        action: "assign",
                        id: t.id,
                        queueId: new FormData(e.currentTarget).get("queueId"),
                      });
                    }}
                  >
                    <label className="field-label">
                      Assign waiting guest
                      <select name="queueId" className="field-control" required>
                        <option value="">Choose a suitable party</option>
                        {queue
                          ?.filter(
                            (q) =>
                              q.status === "waiting" &&
                              q.party_size <= t.capacity,
                          )
                          .map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.queue_number} · {q.name} ({q.party_size})
                              {q.suggested_table_number === t.table_number
                                ? " · suggested"
                                : ""}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button className="text-brand mt-2 text-sm" disabled={busy}>
                      Assign and call
                    </button>
                  </form>
                )}
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer">Manager override</summary>
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act({
                        action: "status",
                        id: t.id,
                        status: f.get("status"),
                        reason: f.get("reason"),
                      });
                    }}
                  >
                    <select name="status" className="field-control">
                      {tableStatuses
                        .filter(
                          (s) =>
                            !t.queue_entry_id ||
                            ![
                              "available",
                              "cleaning",
                              "out_of_service",
                            ].includes(s),
                        )
                        .map((s) => (
                        <option key={s}>{s}</option>
                        ))}
                    </select>
                    <input
                      name="reason"
                      required
                      minLength={5}
                      maxLength={300}
                      placeholder="Reason (recorded in audit history)"
                      className="field-control"
                    />
                    <button disabled={busy} className="btn btn-secondary">
                      Apply override
                    </button>
                  </form>
                </details>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
