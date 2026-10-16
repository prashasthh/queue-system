import { endpoint } from "@/lib/http";
import { requirePermission } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { flushMessages } from "@/lib/whatsapp/outbox";
export const GET = endpoint(async () => {
  await requirePermission("messages:view");
  return (await getDb()).query(
    "SELECT id,message_type,message,status,provider,attempts,created_at FROM whatsapp_messages ORDER BY created_at DESC LIMIT 100",
  );
});
export const POST = endpoint(async () => {
  await requirePermission("messages:view");
  await flushMessages();
  return { ok: true };
}, true);
