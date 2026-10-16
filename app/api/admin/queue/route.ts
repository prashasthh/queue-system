import { endpoint } from "@/lib/http";
import { requirePermission } from "@/lib/auth";
import { adminQueue, callNext } from "@/lib/queue/service";
import { flushMessages } from "@/lib/whatsapp/outbox";
export const GET = endpoint(async () => {
  await requirePermission("queue:view");
  return adminQueue();
});
export const POST = endpoint(async () => {
  await requirePermission("queue:manage");
  const entry = await callNext();
  await flushMessages();
  return entry;
}, true);
