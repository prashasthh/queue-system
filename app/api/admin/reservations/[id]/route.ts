import { requirePermission } from "@/lib/auth";
import { endpoint, body } from "@/lib/http";
import { z } from "zod";
import { uuid } from "@/lib/validation";
import { arriveReservation } from "@/lib/reservations/arrival";
import { confirmReservation } from "@/lib/reservations/lifecycle";
import { flushMessages } from "@/lib/whatsapp/outbox";
import { getDb } from "@/lib/db";
import { reservation } from "@/lib/reservations/service";
import { audit } from "@/lib/audit";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    await requirePermission("reservations:manage");
    const id = uuid.parse((await params).id),
      input = z
        .object({ action: z.enum(["arrive", "cancel"]) })
        .strict()
        .parse(await body(request));
    const result =
      input.action === "arrive"
        ? await arriveReservation(id, "admin")
        : await confirmReservation(id, "no");
    if (input.action === "cancel") {
      const r = await reservation(id);
      await audit(
        await getDb(),
        r.restaurant_id,
        "admin",
        "reservation_cancel",
        id,
        {},
      );
    }
    await flushMessages();
    return result;
  }, true)(request);
}
