"use client";
import { Badge, Notice, useData } from "../ui/common";
import { money } from "@/lib/utils/format";
export function Overview() {
  const { data, error } = useData<{
    metrics: Record<string, number>;
    upcoming: {
      id: string;
      name: string;
      starts_at: string;
      party_size: number;
      status: string;
    }[];
    recent: { id: string; name: string; total: number; status: string }[];
  }>("/api/admin/overview", 5000);
  return (
    <>
      <Notice message={error} />
      <div className="my-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Object.entries({
          waiting: "Currently waiting",
          reservations: "Reservations today",
          available: "Tables available",
          occupied: "Tables occupied",
          orders: "Paid orders today",
          sales: "Food sales today",
          wait_minutes: "Average wait (min)",
        }).map(([k, label]) => (
          <div className="panel" key={k}>
            <p className="text-xs text-stone-500">{label}</p>
            <p className="serif mt-3 text-3xl">
              {data
                ? k === "sales"
                  ? money(data.metrics[k])
                  : data.metrics[k]
                : "—"}
            </p>
          </div>
        ))}
      </div>
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel">
            <h2 className="font-semibold mb-4">Upcoming reservations</h2>
            {!data.upcoming.length && (
              <p className="text-stone-500">No upcoming reservations.</p>
            )}
            {data.upcoming.map((r) => (
              <p key={r.id} className="my-3 text-sm">
                {r.name} · {r.party_size} guests ·{" "}
                {new Date(r.starts_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
              </p>
            ))}
          </section>
          <section className="panel">
            <h2 className="font-semibold mb-4">Recent orders</h2>
            {!data.recent.length && (
              <p className="text-stone-500">No orders yet.</p>
            )}
            {data.recent.map((o) => (
              <div
                key={o.id}
                className="my-3 flex justify-between gap-2 text-sm"
              >
                <span>
                  {o.name} · {money(o.total)}
                </span>
                <Badge status={o.status} />
              </div>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
