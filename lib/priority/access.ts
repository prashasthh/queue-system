import { requireVisit } from "../auth";
import { customerReservation } from "../reservations/access";
import { purchase, type VisitKind } from "./service";
export async function priorityAccess(kind: VisitKind, id: string) {
  if (kind === "queue") await requireVisit(id);
  else await customerReservation(id);
}
export async function purchaseAccess(id: string) {
  const p = await purchase(id);
  if (p.queue_entry_id) await requireVisit(p.queue_entry_id);
  else await customerReservation(p.reservation_id!);
  return p;
}
