import { z } from "zod";
import { getDb } from "@/lib/db";
import { validHmac } from "@/lib/payments/signature";
import { RazorpayPaymentProvider } from "@/lib/payments/razorpay";
import { finalizePayment } from "@/lib/payments/service";
import { finalizePriority } from "@/lib/priority/payments";
import { AppError, errorResponse } from "@/lib/utils/errors";
import { flushMessages } from "@/lib/whatsapp/outbox";
import { readText } from "@/lib/http";
const schema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z
      .object({ entity: z.object({ id: z.string(), order_id: z.string() }) })
      .optional(),
  }),
});
export async function POST(request: Request) {
  try {
    if (process.env.PAYMENT_PROVIDER !== "razorpay")
      throw new AppError("Razorpay is disabled", 403);
    const raw = await readText(request, 100000);
    if (
      !validHmac(
        raw,
        request.headers.get("x-razorpay-signature") || "",
        process.env.RAZORPAY_WEBHOOK_SECRET || "",
      )
    )
      throw new AppError("Invalid webhook signature", 400);
    const event = schema.parse(JSON.parse(raw));
    if (!["payment.captured", "order.paid"].includes(event.event))
      return Response.json({ received: true });
    const entity = event.payload.payment?.entity;
    if (!entity) throw new AppError("Missing payment entity");
    const [p] = await (
      await getDb()
    ).query<{
      order_id: string | null;
      priority_purchase_id: string | null;
      amount: number;
    }>(
      "SELECT order_id,priority_purchase_id,amount FROM payments WHERE provider='razorpay' AND provider_order_id=$1",
      [entity.order_id],
    );
    if (!p) throw new AppError("Payment not yet recorded; retry webhook", 503);
    await new RazorpayPaymentProvider().capturedPayment(
      entity.id,
      entity.order_id,
      p.amount,
    );
    if (p.priority_purchase_id)
      await finalizePriority(
        p.priority_purchase_id,
        entity.id,
        true,
        "razorpay",
      );
    else await finalizePayment(p.order_id!, entity.id, true, "razorpay");
    await flushMessages();
    return Response.json({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
}
