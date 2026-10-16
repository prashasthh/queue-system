import { endpoint, body } from "@/lib/http";
import { requireVisit, rateLimit } from "@/lib/auth";
import { orderSchema } from "@/lib/validation";
import { createOrder } from "@/lib/orders/service";
export const POST = endpoint(async (req) => {
  const input = orderSchema.parse(await body(req));
  await requireVisit(input.queueEntryId);
  await rateLimit(`orders:${input.queueEntryId}`, 20, 600);
  return createOrder(input);
}, true);
