"use client";
import { useState } from "react";
import { api, Loading, Notice, useData } from "../ui/common";
import type { Settings } from "@/lib/settings/service";
const labels: Record<keyof Settings, string> = {
  opening_time: "Opening time (IST)",
  closing_time: "Closing time (IST)",
  reservation_capacity: "Reservation capacity (guests)",
  occupancy_minutes: "Dining time (minutes)",
  reminder_first: "First reminder (minutes before)",
  reminder_second: "Second reminder (minutes before)",
  no_show_minutes: "Confirmation grace (minutes after)",
  vip_fee: "VIP fee (paise)",
  vip_discount: "VIP discount (%)",
  commitment_minimum: "Commitment deposit (paise)",
  commitment_policy: "Unused commitment policy",
  vip_weight: "VIP weight",
  commitment_weight: "Commitment weight",
  returning_visit_threshold: "Previous visits for returning offer",
  frequent_visit_threshold: "Visits for loyalty offer",
  high_value_spend_threshold: "Spend for loyalty offer (paise)",
  recovery_rating_threshold: "Rating at or below for recovery offer",
  returning_discount: "Returning customer discount (%)",
  loyalty_discount: "Loyalty discount (%)",
  recovery_discount: "Recovery discount (%)",
};
export function SettingsPanel() {
  const { data, error, refresh } = useData<Settings>("/api/admin/settings"),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data)
    return (
      <>
        <Notice message={error} />
        <Loading error={error} />
      </>
    );
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        setFailure("");
        const f = new FormData(e.currentTarget);
        const input = Object.fromEntries(
          Object.keys(labels).map((k) => [
            k,
            k.endsWith("time") || k === "commitment_policy"
              ? f.get(k)
              : Number(f.get(k)),
          ]),
        );
        try {
          await api("/api/admin/settings", input, "PATCH");
          setMessage("Settings saved");
          await refresh();
        } catch (e) {
          setFailure(e instanceof Error ? e.message : "Could not save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {(Object.keys(labels) as (keyof Settings)[]).map((key) => (
          <label key={key} className="field-label">
            {labels[key]}
            {key === "commitment_policy" ? (
              <select
                name={key}
                className="field-control"
                defaultValue={data[key]}
              >
                <option value="retain_minimum">
                  Retain minimum commitment
                </option>
                <option value="refund_unused">Refund unused credit</option>
              </select>
            ) : (
              <input
                name={key}
                type={key.endsWith("time") ? "time" : "number"}
                className="field-control"
                defaultValue={data[key]}
                required
              />
            )}
          </label>
        ))}
      </div>
      <p className="my-5 text-sm text-stone-500">
        Currency INR · timezone Asia/Kolkata. Amounts use paise: 100000 =
        ₹1,000.
      </p>
      <Notice message={failure || error} />
      <Notice success message={message} />
      <button className="btn" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
