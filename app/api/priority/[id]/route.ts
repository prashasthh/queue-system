import { z } from "zod";
import { body, endpoint } from "@/lib/http";
import { uuid, verifySchema } from "@/lib/validation";
import { purchaseAccess } from "@/lib/priority/access";
import { reviewPriority } from "@/lib/priority/service";
import {
  mockPriority,
  startPriorityPayment,
  finalizePriority,
} from "@/lib/priority/payments";
import { paymentProvider } from "@/lib/payments";
import { RazorpayPaymentProvider } from "@/lib/payments/razorpay";
import { AppError } from "@/lib/utils/errors";
import { flushMessages } from "@/lib/whatsapp/outbox";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => ({
    purchase: await purchaseAccess(uuid.parse((await params).id)),
    provider: paymentProvider().name,
    keyId: process.env.RAZORPAY_KEY_ID || "",
  }))(request);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = uuid.parse((await params).id);
    await purchaseAccess(id);
    const input = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("review") }).strict(),
        z.object({ action: z.literal("start") }).strict(),
        z.object({ action: z.literal("mock"), success: z.boolean() }).strict(),
        verifySchema.extend({ action: z.literal("verify") }),
      ])
      .parse(await body(request));
    let result;
    if (input.action === "review") result = await reviewPriority(id);
    else if (input.action === "start") result = await startPriorityPayment(id);
    else if (input.action === "mock")
      result = await mockPriority(id, input.success);
    else {
      const provider = paymentProvider();
      if (!(provider instanceof RazorpayPaymentProvider))
        throw new AppError("Razorpay disabled", 403);
      const p = await startPriorityPayment(id);
      if (
        p.provider_order_id !== input.razorpay_order_id ||
        !provider.verifySignature(
          p.provider_order_id,
          input.razorpay_payment_id,
          input.razorpay_signature,
        )
      )
        throw new AppError("Invalid signature");
      await provider.capturedPayment(
        input.razorpay_payment_id,
        p.provider_order_id,
        p.amount,
      );
      result = await finalizePriority(
        id,
        input.razorpay_payment_id,
        true,
        "razorpay",
      );
    }
    await flushMessages();
    return result;
  }, true)(request);
}
