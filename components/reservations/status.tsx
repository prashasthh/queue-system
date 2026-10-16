"use client";
import { Badge, Loading, Notice, useData, api } from "../ui/common";
import { useState } from "react";
import type { Reservation } from "@/lib/reservations/service";
export function ReservationStatus({
  id,
  token = "",
}: {
  id: string;
  token?: string;
}) {
  const { data, error, refresh } = useData<Reservation>(
    `/api/reservations/${id}?token=${encodeURIComponent(token)}`,
    5000,
  );
  const [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  async function act(value: { answer: "yes" | "no" } | { action: "arrive" }) {
    setBusy(true);
    setFailure("");
    try {
      const result = await api<Reservation & { visitUrl?: string }>(
        `/api/reservations/${id}`,
        { ...value, token },
      );
      if (result.visitUrl) window.location.assign(result.visitUrl);
      else await refresh();
    } catch (e) {
      setFailure(
        e instanceof Error ? e.message : "Could not update reservation",
      );
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
  return (
    <div className="panel space-y-5">
      <p className="eyebrow">{data.restaurant_name}</p>
      <h1 className="serif text-4xl">Your reservation</h1>
      <Badge status={data.status} />
      <p>
        {data.name} · {data.party_size} guests
      </p>
      <p>
        {new Date(data.starts_at).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}{" "}
        IST
      </p>
      {data.table_number && (
        <p className="rounded-xl bg-stone-50 p-3 text-sm">
          Planned table: <strong>{data.table_number}</strong>
        </p>
      )}
      <p className="text-stone-500">
        Please keep this page. We’ll ask you to confirm before your arrival.
      </p>
      {data.notes && <p>Special request: {data.notes}</p>}
      {[
        "pending",
        "confirmed",
        "reminder_sent",
        "awaiting_confirmation",
      ].includes(data.status) && (
        <div>
          <h2 className="font-semibold mb-3">Are you still coming?</h2>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map((answer) => (
              <button
                key={answer}
                disabled={busy}
                className={answer === "yes" ? "btn" : "btn btn-secondary"}
                onClick={() => void act({ answer })}
              >
                {answer === "yes"
                  ? "YES, I’m coming"
                  : "NO, cancel reservation"}
              </button>
            ))}
          </div>
        </div>
      )}
      {[
        "pending",
        "confirmed",
        "reminder_sent",
        "awaiting_confirmation",
      ].includes(data.status) && (
        <button
          className="btn w-full"
          disabled={busy}
          onClick={() => void act({ action: "arrive" })}
        >
          I’ve arrived at the restaurant
        </button>
      )}
      <Notice message={error || failure} />
    </div>
  );
}
