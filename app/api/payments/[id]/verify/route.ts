import { endpoint, body } from "@/lib/http";
import { uuid, verifySchema } from "@/lib/validation";
import { customerOrder } from "@/lib/orders/access";
import { getDb } from "@/lib/db";
import { paymentProvider } from "@/lib/payments";
import type { PaymentRecord } from "@/lib/payments/provider";
import { RazorpayPaymentProvider } from "@/lib/payments/razorpay";
import { finalizePayment } from "@/lib/payments/service";
import { AppError } from "@/lib/utils/errors";
import { flushMessages } from "@/lib/whatsapp/outbox";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async (request) => {
    const id = uuid.parse((await params).id);
    await customerOrder(id);
    const input = verifySchema.parse(await body(request));
    const provider = paymentProvider();
    if (!(provider instanceof RazorpayPaymentProvider))
      throw new AppError("Razorpay is disabled", 403);
    const [p] = await (
      await getDb()
    ).query<PaymentRecord>(
      "SELECT * FROM payments WHERE order_id=$1 AND provider='razorpay'",
      [id],
    );
    if (
      !p ||
      p.provider_order_id !== input.razorpay_order_id ||
      !provider.verifySignature(
        p.provider_order_id,
        input.razorpay_payment_id,
        input.razorpay_signature,
      )
    )
      throw new AppError("Invalid payment signature", 400);
    await provider.capturedPayment(
      input.razorpay_payment_id,
      p.provider_order_id,
      p.amount,
    );
    const result = await finalizePayment(
      id,
      input.razorpay_payment_id,
      true,
      "razorpay",
    );
    await flushMessages();
    return result;
  }, true)(req);
}
