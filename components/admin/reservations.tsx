"use client";
import { Badge, Loading, Notice, useData, api } from "../ui/common";
import { useState } from "react";
import type { Reservation } from "@/lib/reservations/service";
export function ReservationsDashboard() {
  const { data, error, refresh } = useData<Reservation[]>(
    "/api/admin/reservations",
    5000,
  );
  const [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Notice message={error || failure} />
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="panel overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Guest",
                  "Phone",
                  "Party",
                  "Time (IST)",
                  "Status",
                  "Request",
                  "Actions",
                ].map((v) => (
                  <th className="p-3" key={v}>
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id} className="border-t border-stone-100">
                  <td className="p-3">{v.name}</td>
                  <td>{v.phone}</td>
                  <td>{v.party_size}</td>
                  <td>
                    {new Date(v.starts_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                  <td>
                    <Badge status={v.status} />
                    {v.table_number && (
                      <p className="mt-1 text-xs text-stone-500">
                        Table {v.table_number}
                      </p>
                    )}
                  </td>
                  <td>{v.notes}</td>
                  <td className="p-3">
                    {[
                      "pending",
                      "confirmed",
                      "reminder_sent",
                      "awaiting_confirmation",
                    ].includes(v.status) && (
                      <div className="flex gap-2">
                        {["arrive", "cancel"].map((action) => (
                          <button
                            key={action}
                            disabled={busy}
                            className="btn btn-secondary !px-3 !py-2"
                            onClick={async () => {
                              setBusy(true);
                              setFailure("");
                              try {
                                await api(`/api/admin/reservations/${v.id}`, {
                                  action,
                                });
                                await refresh();
                              } catch (e) {
                                setFailure((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {action === "arrive" ? "Mark arrived" : "Cancel"}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.length && <p className="p-6">No reservations yet.</p>}
        </div>
      )}
    </>
  );
}
