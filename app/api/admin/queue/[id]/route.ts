import { endpoint, body } from "@/lib/http";
import { requirePermission } from "@/lib/auth";
import { queueStatusSchema, uuid } from "@/lib/validation";
import { changeQueue } from "@/lib/queue/service";
import { flushMessages } from "@/lib/whatsapp/outbox";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async (req) => {
    await requirePermission("queue:manage");
    const id = uuid.parse((await params).id);
    const { status } = queueStatusSchema.parse(await body(req));
    const entry = await changeQueue(id, status);
    await flushMessages();
    return entry;
  }, true)(request);
}
