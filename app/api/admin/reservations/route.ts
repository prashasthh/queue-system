import { requirePermission } from "@/lib/auth";
import { endpoint } from "@/lib/http";
import { restaurant } from "@/lib/queue/service";
import { reservations } from "@/lib/reservations/service";
export const GET = endpoint(async () => {
  await requirePermission("reservations:view");
  return reservations((await restaurant("demo-restaurant")).id);
});
