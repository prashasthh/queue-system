"use client";
import Link from "next/link";
import { Loading, Notice, useData } from "../ui/common";
import type { CustomerProfile } from "@/lib/customers/service";
import { money } from "@/lib/utils/format";
interface Detail {
  profile: CustomerProfile;
  visits: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  reservations: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  feedback: Array<Record<string, unknown>>;
  discounts: Array<Record<string, unknown>>;
  favorites: Array<{ name: string; quantity: number }>;
}
export function CustomerDetail({ id }: { id: string }) {
  const { data, error } = useData<Detail>(`/api/admin/customers/${id}`);
  if (!data)
    return (
      <>
        <Notice message={error} />
        <Loading error={error} />
      </>
    );
  const profile = data.profile;
  return (
    <>
      <Link href="/admin/customers" className="text-sm text-brand">
        ← Customers
      </Link>
      <h1 className="serif mt-4 text-4xl">{profile.name}</h1>
      <p className="mt-2 text-stone-500">{profile.phone}</p>
      <div className="my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Visits", profile.total_visits],
          ["Completed", profile.completed_visits],
          ["Total spend", money(profile.total_spend)],
          ["Average bill", money(profile.average_bill)],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <p className="text-xs text-stone-500">{label}</p>
            <p className="serif mt-2 text-3xl">{value}</p>
          </div>
        ))}
      </div>
      {!!data.favorites.length && (
        <section className="panel mb-5">
          <h2 className="serif text-2xl">Favourite items</h2>
          <p className="mt-3 text-sm text-stone-600">
            {data.favorites
              .map((item) => `${item.name} (${item.quantity})`)
              .join(" · ")}
          </p>
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {(
          [
            "visits",
            "orders",
            "reservations",
            "payments",
            "feedback",
            "discounts",
          ] as const
        ).map((section) => (
          <section className="panel overflow-auto" key={section}>
            <h2 className="serif mb-3 text-2xl capitalize">{section}</h2>
            <div className="space-y-3 text-xs">
              {data[section].map((entry, index) => (
                <pre
                  className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3"
                  key={String(entry.id || index)}
                >
                  {Object.entries(entry)
                    .map(
                      ([key, value]) =>
                        `${key.replaceAll("_", " ")}: ${value ?? "—"}`,
                    )
                    .join("\n")}
                </pre>
              ))}
              {!data[section].length && (
                <p className="text-stone-500">No records.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
