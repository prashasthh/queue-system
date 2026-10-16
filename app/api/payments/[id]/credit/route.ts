import { endpoint } from "@/lib/http";
import { uuid } from "@/lib/validation";
import { customerOrder } from "@/lib/orders/access";
import { settleCredit } from "@/lib/payments/service";
import { flushMessages } from "@/lib/whatsapp/outbox";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = uuid.parse((await params).id);
    await customerOrder(id);
    const result = await settleCredit(id);
    await flushMessages();
    return result;
  }, true)(request);
}
