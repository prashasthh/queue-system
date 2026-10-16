"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../ui/common";
import { can } from "@/lib/staff/permissions";
import type { StaffRole } from "@/lib/staff/service";
export function AdminNav({role,name}:{role:StaffRole;name:string}) {
  const path = usePathname(),
    router = useRouter();
  return (
    <aside className="self-start rounded-2xl border border-stone-200 bg-white p-4 lg:sticky lg:top-5">
      <nav className="flex flex-wrap gap-4 text-sm font-semibold lg:flex-col">
        {([
          ["/admin", "Overview","overview:view"], ["/admin/queue", "Queue","queue:view"], ["/admin/orders", "Orders","orders:view"],
          ["/admin/reservations", "Reservations","reservations:view"], ["/admin/floor", "Floor","floor:view"],
          ["/admin/customers", "Customers","customers:view"], ["/admin/menu", "Menu","menu:view"],
          ["/admin/feedback", "Feedback","feedback:view"], ["/admin/staff", "Staff","staff:view"],
          ["/admin/payments", "Payments","payments:manage"],
          ["/admin/payroll", "Payroll","payroll:view"],
          ["/admin/attendance", "Attendance","attendance:view"], ["/admin/settings", "Settings","settings:manage"],
          ["/admin/messages", "Messages","messages:view"],
        ] as const).filter(([, ,permission])=>can(role,permission)).map(([url, label]) => (
          <Link
            key={url}
            href={url}
            className={path === url ? "text-brand" : "text-stone-500"}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p className="mt-6 border-t border-stone-100 pt-4 text-xs"><span className="font-semibold text-stone-700">{name}</span><br/><span className="capitalize text-stone-400">{role}</span></p>
      <button
        className="mt-6 text-xs text-stone-500"
        onClick={async () => {
          await api("/api/admin/login", undefined, "DELETE");
          router.refresh();
        }}
      >
        Sign out
      </button>
    </aside>
  );
}
