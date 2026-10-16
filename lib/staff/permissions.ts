import type { StaffRole } from "./service";
export type Permission =
  | "overview:view" | "queue:view" | "queue:manage" | "orders:view" | "orders:manage"
  | "reservations:view" | "reservations:manage" | "floor:view" | "floor:manage"
  | "customers:view" | "menu:view" | "menu:manage" | "feedback:view"
  | "settings:manage" | "messages:view" | "staff:view" | "staff:manage"
  | "attendance:view" | "attendance:manage" | "payments:manage" | "payroll:view" | "payroll:manage";
const allPermissions:Permission[]=["overview:view","queue:view","queue:manage","orders:view","orders:manage","reservations:view","reservations:manage","floor:view","floor:manage","customers:view","menu:view","menu:manage","feedback:view","settings:manage","messages:view","staff:view","staff:manage","attendance:view","attendance:manage","payments:manage","payroll:view","payroll:manage"];
const rolePermissions:Record<StaffRole,Permission[]>={
  owner:allPermissions, manager:allPermissions.filter((p)=>p!=="staff:manage"),
  reception:["overview:view","queue:view","queue:manage","reservations:view","reservations:manage","floor:view","floor:manage","customers:view"],
  waiter:["overview:view","floor:view","floor:manage","orders:view","orders:manage","customers:view"],
  kitchen:["overview:view","orders:view","orders:manage"], cashier:["overview:view","orders:view","payments:manage","customers:view"],
};
export function can(role:StaffRole,permission:Permission){ return rolePermissions[role].includes(permission); }
