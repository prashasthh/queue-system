"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Loading, Notice, useData } from "../ui/common";
import type { QueueEntry } from "@/types";
const labels = {
  waiting: "Waiting for your turn",
  called: "Your turn is coming!",
  seated: "You’re seated",
  completed: "Visit completed",
  cancelled: "Visit cancelled",
};
export function QueueStatus({ id }: { id: string }) {
  const { data: q, error } = useData<QueueEntry>(`/api/queue/${id}`, 4000),
    [refreshIn, setRefreshIn] = useState(4);
  useEffect(() => {
    const timer = window.setInterval(
      () => setRefreshIn((seconds) => (seconds <= 1 ? 4 : seconds - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <>
      <Notice message={error} />
      {!q ? (
        <Loading error={error} />
      ) : (
        <>
          <p className="eyebrow text-brand">{q.restaurant_name}</p>
          <h1 className="serif my-4 text-4xl">
            {q.status === "waiting" ? "You’re in the queue!" : labels[q.status]}
          </h1>
          <p className="mb-7 text-stone-500">
            Welcome, {q.name}. Your spot is saved for {q.party_size}.
          </p>
          <p className="mb-4 capitalize">
            {q.priority_type === "standard"
              ? "Free standard queue"
              : `${q.priority_type} fast-track active`}{" "}
            {q.status === "waiting" && (
              <Link
                className="ml-3 underline text-brand"
                href={`/priority/queue/${id}`}
              >
                Review priority options
              </Link>
            )}
          </p>
          {q.status === "waiting" && q.priority_type !== "standard" && (
            <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              You have moved ahead of the standard queue. We’ll call you as soon
              as a suitable table is available.
            </p>
          )}
          <div className="panel overflow-hidden text-center">
            {q.table_number && (
              <p className="mb-4 text-lg font-semibold text-brand">
                Your table: {q.table_number}
              </p>
            )}
            <Badge status={q.status} />
            <p className="eyebrow mt-8 text-stone-400">Your queue number</p>
            <p className="serif my-5 text-8xl text-[#5a2b18]">
              {q.queue_number}
            </p>
            {q.status === "waiting" ? (
              <>
                <p
                  aria-live="polite"
                  className="text-xl text-stone-600"
                  key={q.people_ahead}
                >
                  <strong className="text-ink">{q.people_ahead}</strong>{" "}
                  {q.people_ahead === 1 ? "party" : "parties"} ahead
                </p>
                <div className="mx-auto my-8 grid h-56 w-56 place-items-center rounded-full bg-stone-100 p-3 shadow-inner">
                  <div
                    className="grid h-full w-full place-items-center rounded-full p-3 transition-all duration-700"
                    style={{
                      background: `conic-gradient(#c75b37 ${(refreshIn / 4) * 360}deg, #eadfd6 0deg)`,
                    }}
                  >
                    <div className="grid h-full w-full place-items-center rounded-full bg-[#fffdfa]">
                      <div>
                        <p className="serif text-5xl text-[#5a2b18]">
                          ~{q.estimated_minutes}
                        </p>
                        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                          minutes
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="font-medium text-stone-700">{labels[q.status]}</p>
                <p className="mt-3 text-xs text-stone-400">
                  Live status · checking again in {refreshIn}s
                </p>
              </>
            ) : (
              <div className="mt-8 rounded-2xl bg-[#f7f0ea] p-6">
                <p className="serif text-3xl text-[#5a2b18]">
                  {q.status === "called" ? "Ready now" : labels[q.status]}
                </p>
                <p className="mt-2 text-sm text-stone-500">
                  {q.status === "called"
                    ? "Please make your way to the host."
                    : "Your live visit status has been updated."}
                </p>
              </div>
            )}
            <p className="mt-6 border-t border-dashed border-stone-200 pt-5 text-xs leading-5 text-stone-400">
              The estimate updates when the live queue changes: parties ahead ×{" "}
              {q.average_service_minutes} minutes. Actual seating times may vary.
            </p>
          </div>
          {!["cancelled", "completed"].includes(q.status) && (
            <Link href={`/menu/${q.id}`} className="btn mt-6 w-full">
              Explore the menu →
            </Link>
          )}
          {["cancelled", "completed"].includes(q.status) && (
            <Link
              href={`/r/${q.restaurant_slug}`}
              className="btn mt-6 w-full"
            >
              Start a new visit →
            </Link>
          )}
          <p className="mt-4 text-center text-xs text-stone-500">
            Keep this browser handy to access your visit.
          </p>
        </>
      )}
    </>
  );
}
