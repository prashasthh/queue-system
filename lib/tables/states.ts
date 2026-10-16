export const tableStatuses = [
  "available",
  "reserved",
  "waiting_for_guests",
  "occupied",
  "ordering",
  "preparing",
  "dining",
  "payment_pending",
  "cleaning",
  "out_of_service",
] as const;
export type TableStatus = (typeof tableStatuses)[number];
export const tableTransitions: Record<TableStatus, TableStatus[]> = {
  available: ["reserved", "waiting_for_guests", "out_of_service"],
  reserved: ["waiting_for_guests", "available", "out_of_service"],
  waiting_for_guests: ["occupied", "available"],
  occupied: ["ordering", "cleaning"],
  ordering: ["preparing", "payment_pending", "cleaning"],
  preparing: ["dining"],
  dining: ["payment_pending"],
  payment_pending: ["cleaning"],
  cleaning: ["available", "out_of_service"],
  out_of_service: ["available"],
};
