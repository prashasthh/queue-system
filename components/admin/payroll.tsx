"use client";
import { useState } from "react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import { money } from "@/lib/utils/format";
type Row = {
  id: string;
  name: string;
  role: string;
  period_start: string;
  period_end: string;
  base_salary: number;
  attendance_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  earned_salary: number;
  bonus: number;
  deductions: number;
  net_payable: number;
  status: string;
  notes: string;
};
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export function PayrollManager() {
  const now = new Date(),
    [start, setStart] = useState(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    ),
    [end, setEnd] = useState(today()),
    { data, error, refresh } = useData<Row[]>("/api/admin/payroll"),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setFailure("");
    try {
      await api("/api/admin/payroll", payload);
      setMessage("Payroll records updated");
      await refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="serif text-4xl">Payroll</h1>
          <p className="mt-2 text-stone-500">
            Attendance-based payroll records. No money is transferred.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="field-label">
            From
            <input
              className="field-control"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field-label">
            To
            <input
              className="field-control"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button
            className="btn mb-px"
            disabled={busy}
            onClick={() =>
              act({ action: "generate", periodStart: start, periodEnd: end })
            }
          >
            Generate payroll
          </button>
        </div>
      </div>
      <Notice message={failure || error} />
      <Notice success message={message} />
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mt-6 grid gap-4">
          {data.map((r) => (
            <article className="panel" key={r.id}>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{r.name}</h2>
                  <p className="text-xs capitalize text-stone-500">
                    {r.role} · {r.period_start} to {r.period_end}
                  </p>
                </div>
                <div className="text-right">
                  <Badge status={r.status} />
                  <p className="serif mt-2 text-2xl">{money(r.net_payable)}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-6">
                {[
                  ["Base", money(r.base_salary)],
                  ["Attendance", `${r.attendance_days} days`],
                  ["Paid leave", `${r.paid_leave_days} days`],
                  ["Unpaid leave", `${r.unpaid_leave_days} days`],
                  ["Bonus", money(r.bonus)],
                  ["Deductions", money(r.deductions)],
                ].map(([a, b]) => (
                  <div key={a}>
                    <p className="text-xs text-stone-500">{a}</p>
                    <b>{b}</b>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {r.status === "draft" && (
                  <>
                    <button
                      className="rounded-lg border px-3 py-2 text-xs font-semibold"
                      disabled={busy}
                      onClick={() => {
                        const bonus = prompt(
                            "Bonus in rupees",
                            String(r.bonus / 100),
                          ),
                          deductions =
                            bonus &&
                            prompt(
                              "Deductions in rupees",
                              String(r.deductions / 100),
                            ),
                          notes =
                            deductions !== null &&
                            prompt("Notes", r.notes || "");
                        if (bonus && deductions !== null && notes !== null)
                          void act({
                            action: "adjust",
                            id: r.id,
                            bonus: Math.round(Number(bonus) * 100),
                            deductions: Math.round(Number(deductions) * 100),
                            notes,
                          });
                      }}
                    >
                      Adjust
                    </button>
                    <button
                      className="btn !px-3 !py-2 text-xs"
                      disabled={busy}
                      onClick={() =>
                        act({
                          action: "transition",
                          id: r.id,
                          status: "approved",
                        })
                      }
                    >
                      Approve
                    </button>
                  </>
                )}
                {r.status === "approved" && (
                  <button
                    className="btn !px-3 !py-2 text-xs"
                    disabled={busy}
                    onClick={() =>
                      act({ action: "transition", id: r.id, status: "paid" })
                    }
                  >
                    Mark paid
                  </button>
                )}
              </div>
            </article>
          ))}
          {!data.length && (
            <p className="panel text-stone-500">
              Generate a pay period after staff salaries and attendance are
              recorded.
            </p>
          )}
        </div>
      )}
    </>
  );
}
