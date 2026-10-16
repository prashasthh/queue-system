import { endpoint, body } from "@/lib/http";
import { uuid, mockPaymentSchema } from "@/lib/validation";
import { customerOrder } from "@/lib/orders/access";
import { mockComplete } from "@/lib/payments/service";
import { flushMessages } from "@/lib/whatsapp/outbox";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async (request) => {
    const id = uuid.parse((await params).id);
    await customerOrder(id);
    const { result } = mockPaymentSchema.parse(await body(request));
    const order = await mockComplete(id, result === "success");
    await flushMessages();
    return order;
  }, true)(req);
}
