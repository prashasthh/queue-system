"use client";
import Link from "next/link";
import { useState } from "react";
import { Loading, Notice, useData } from "../ui/common";
import type { CustomerProfile } from "@/lib/customers/service";
import { money } from "@/lib/utils/format";
export function CustomersDashboard() {
  const [search, setSearch] = useState(""),
    { data, error } = useData<CustomerProfile[]>(
      `/api/admin/customers?search=${encodeURIComponent(search)}`,
    );
  return (
    <>
      <input
        className="mb-5 max-w-md"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name or phone"
        aria-label="Search customers"
      />
      <Notice message={error} />
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Customer",
                  "Visits",
                  "Spend",
                  "Average bill",
                  "Last visit",
                  "Priority",
                  "Feedback",
                  "No-shows",
                ].map((label) => (
                  <th className="p-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((customer) => (
                <tr className="border-t border-stone-100" key={customer.id}>
                  <td className="p-3">
                    <Link
                      className="font-semibold text-brand"
                      href={`/admin/customers/${customer.id}`}
                    >
                      {customer.name}
                    </Link>
                    <p className="text-xs text-stone-500">{customer.phone}</p>
                  </td>
                  <td>{customer.total_visits}</td>
                  <td>{money(customer.total_spend)}</td>
                  <td>{money(customer.average_bill)}</td>
                  <td>
                    {customer.last_visit
                      ? new Date(customer.last_visit).toLocaleDateString(
                          "en-IN",
                        )
                      : "—"}
                  </td>
                  <td>{customer.priority_type || "standard"}</td>
                  <td>{customer.average_feedback ?? "—"}</td>
                  <td>{customer.no_shows}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.length && (
            <p className="p-8 text-center text-stone-500">
              No matching customers.
            </p>
          )}
        </div>
      )}
    </>
  );
}
