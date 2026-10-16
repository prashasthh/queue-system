"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import type { QueueEntry, QueueStatus } from "@/types";
import { time } from "@/lib/utils/format";
export function AdminLogin({ development }: { development: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow text-brand">The host stand</p>
      <h1 className="serif my-4 text-4xl">Welcome back.</h1>
      <p className="mb-8 text-stone-500">Sign in to manage your dining room.</p>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/api/admin/login", {
              email: (new FormData(e.currentTarget).get("email") as string) || undefined,
              password: new FormData(e.currentTarget).get("password"),
            });
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label">
          Staff email <span className="font-normal text-stone-400">(optional for local owner)</span>
          <input className="field-control my-3" name="email" type="email" autoComplete="username" />
        </label>
        <label className="field-label">
          Staff password
          <input
            className="field-control my-3"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <Notice message={error} />
        <button className="btn w-full" disabled={busy}>
          {busy ? "Signing in…" : "Open dashboard"}
        </button>
        {development && (
          <p className="mt-4 text-xs text-stone-500">
            Local demo password: <code>dev-tableline</code>
          </p>
        )}
      </form>
    </div>
  );
}
export function QueueDashboard() {
  const {
    data: queue,
    error,
    refresh,
  } = useData<QueueEntry[]>("/api/admin/queue", 4000);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [filter, setFilter] = useState("all");
  async function action(id?: string, status?: QueueStatus) {
    setBusy(true);
    setFailure("");
    try {
      const q = await api<QueueEntry>(
        id ? `/api/admin/queue/${id}` : "/api/admin/queue",
        id ? { status } : {},
        id ? "PATCH" : "POST",
      );
      setNotice(`${q.queue_number} · ${q.name} is ${q.status}`);
      await refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="my-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {["waiting", "called", "seated", "completed"].map((s, i) => (
          <div
            key={s}
            className={`panel ${i === 0 ? "!border-[#4a3025] !bg-[#4a3025] text-white" : ""}`}
          >
            <p className="text-xs capitalize opacity-70">
              {s === "completed" ? "Completed today" : s}
            </p>
            <p className="serif mt-4 text-4xl">
              {queue ? queue.filter((q) => q.status === s).length : "—"}
            </p>
          </div>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Your guest list</h2>
          <p className="mt-1 text-sm text-stone-500">
            Live queue · Oldest waiting party is called first
          </p>
        </div>
        <button
          className="btn"
          disabled={busy || !queue?.some((q) => q.status === "waiting")}
          onClick={() => action()}
        >
          {busy ? "Updating…" : "Call next customer →"}
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "waiting", "called", "seated", "completed", "cancelled"].map(
          (s) => (
            <button
              onClick={() => setFilter(s)}
              key={s}
              className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${s === filter ? "bg-ink text-white" : "bg-white text-stone-500"}`}
            >
              {s}
            </button>
          ),
        )}
      </div>
      <Notice
        message={
          error || (failure.includes("available table") ? "" : failure)
        }
      />
      {failure.includes("available table") && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">
          <p className="font-semibold">Every suitable table is in use or held.</p>
          <p className="mt-1 text-sm">
            Complete or cancel the active visit first. After cleaning, mark the
            table available so the next waiting party can be called.
          </p>
          <Link
            href="/admin/floor"
            className="mt-3 inline-block text-sm font-bold underline"
          >
            Open floor management →
          </Link>
        </div>
      )}
      <Notice message={notice} success />
      {!queue ? (
        <Loading error={error} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-xs text-stone-500">
              <tr>
                {[
                  "Queue",
                  "Guest",
                  "Party",
                  "Joined",
                  "Position",
                  "Status",
                  "Actions",
                ].map((t) => (
                  <th key={t} className="whitespace-nowrap p-4 font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue
                .filter((q) => filter === "all" || q.status === filter)
                .map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-stone-100 last:border-0"
                  >
                    <td className="p-4 font-bold text-brand">
                      {q.queue_number}
                      {(q.table_number || q.suggested_table_number) && (
                        <p className="mt-1 text-xs font-normal text-stone-500">
                          {q.table_number
                            ? `Table ${q.table_number}`
                            : `Suggested ${q.suggested_table_number}`}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-semibold">{q.name}</p>
                      <p className="mt-1 text-xs text-stone-500">{q.phone}</p>
                    </td>
                    <td className="p-4">{q.party_size} guests</td>
                    <td className="whitespace-nowrap p-4 text-stone-500">
                      {time(q.joined_at)}
                    </td>
                    <td className="p-4 text-stone-500">
                      {q.status === "waiting"
                        ? `${q.people_ahead + 1} in line`
                        : "—"}
                    </td>
                    <td className="p-4">
                      <Badge status={q.status} />
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {(q.status === "waiting"
                          ? ["called", "cancelled"]
                          : q.status === "called"
                            ? ["seated", "waiting", "cancelled"]
                            : q.status === "seated"
                              ? ["completed"]
                              : []
                        ).map((s) => (
                          <button
                            key={s}
                            disabled={busy}
                            onClick={() => action(q.id, s as QueueStatus)}
                            className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold"
                          >
                            {
                              {
                                called: "Call",
                                seated: "Seat",
                                completed: "Complete",
                                cancelled: "Cancel",
                                waiting: "Return to queue",
                              }[s]
                            }
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!queue.filter((q) => filter === "all" || q.status === filter)
            .length && (
            <div className="p-12 text-center text-stone-500">
              No {filter === "all" ? "" : filter} guests yet. New arrivals will
              appear here.
            </div>
          )}
        </div>
      )}
    </>
  );
}
