import { endpoint, body } from "@/lib/http";
import { customerToken, hash, rateLimit, requestIp } from "@/lib/auth";
import { joinSchema } from "@/lib/validation";
import { joinQueue } from "@/lib/queue/service";
import { flushMessages } from "@/lib/whatsapp/outbox";
export const POST = endpoint(async (request) => {
  const input = joinSchema.parse(await body(request));
  await rateLimit(`join:${requestIp(request)}`, 30, 600);
  const token = await customerToken(true);
  const entry = await joinQueue(input, hash(token));
  await flushMessages();
  return entry;
}, true);
