import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { endpoint, body } from "@/lib/http";
import { uuid } from "@/lib/validation";
import { restaurant } from "@/lib/queue/service";
import { floor, changeTable, manualAssign } from "@/lib/tables/service";
import { tableStatuses } from "@/lib/tables/states";
import { flushMessages } from "@/lib/whatsapp/outbox";
export const GET = endpoint(async () => {
  await requirePermission("floor:view");
  return floor((await restaurant("demo-restaurant")).id);
});
export const POST = endpoint(async (request) => {
  await requirePermission("floor:manage");
  const input = z
    .discriminatedUnion("action", [
      z
        .object({
          action: z.literal("status"),
          id: uuid,
          status: z.enum(tableStatuses),
          reason: z.string().trim().min(5).max(300).optional(),
        })
        .strict(),
      z
        .object({ action: z.literal("assign"), id: uuid, queueId: uuid })
        .strict(),
    ])
    .parse(await body(request));
  const result =
    input.action === "status"
      ? await changeTable(input.id, input.status, "admin", input.reason)
      : await manualAssign(input.queueId, input.id, "admin");
  await flushMessages();
  return result;
}, true);
