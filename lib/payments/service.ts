import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { AppError } from "../utils/errors";
import { paymentProvider } from "./index";
import type { PaymentRecord } from "./provider";
import { order } from "../orders/service";
import { queueEntry } from "../queue/service";
import { enqueue } from "../whatsapp/outbox";
import { money } from "../utils/format";
export async function startPayment(orderId: string) {
  return (await getDb()).transaction(async (tx) => {
    const [o] = await tx.query<{
      total: number;
      reviewed_at: string | null;
      status: string;
      payment_status: string;
      queue_entry_id: string;
    }>(
      "SELECT total,reviewed_at,status,payment_status,queue_entry_id FROM orders WHERE id=$1 FOR UPDATE",
      [orderId],
    );
    if (!o) throw new AppError("Order not found", 404);
    if (!o.reviewed_at)
      throw new AppError("Review your order before payment", 409);
    const [existing] = await tx.query<PaymentRecord>(
      "SELECT * FROM payments WHERE order_id=$1",
      [orderId],
    );
    if (existing?.status === "paid") return existing;
    if (o.status !== "draft" || o.payment_status === "paid")
      throw new AppError("This order cannot be paid", 409);
    const q = await queueEntry(o.queue_entry_id, tx);
    if (["cancelled", "completed"].includes(q.status))
      throw new AppError("This visit is closed", 409);
    if (existing) {
      if (
        existing.provider !==
        (o.total === 0 ? "credit" : paymentProvider().name)
      )
        throw new AppError(
          "Payment mode changed. Ask staff for help with this order.",
          409,
        );
      return existing;
    }
    const provider = paymentProvider();
    const result =
      o.total === 0
        ? { id: `credit_${orderId}` }
        : await provider.create(o.total, orderId);
    const [payment] = await tx.query<PaymentRecord>(
      "INSERT INTO payments(order_id,provider,provider_order_id,amount,purpose,method) SELECT $1,$2,$3,$4,CASE WHEN credit_applied>0 THEN 'remaining_balance' ELSE 'food_order' END,CASE WHEN $4::int=0 THEN 'credit' ELSE 'online' END FROM orders WHERE id=$1 RETURNING *",
      [orderId, o.total === 0 ? "credit" : provider.name, result.id, o.total],
    );
    return payment;
  });
}
export async function finalizePayment(
  orderId: string,
  paymentId: string,
  success: boolean,
  expectedProvider: "mock" | "razorpay" | "credit" | "cash",
) {
  return (await getDb()).transaction(async (tx) => {
    await tx.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [orderId]);
    const [payment] = await tx.query<PaymentRecord>(
      "SELECT * FROM payments WHERE order_id=$1 FOR UPDATE",
      [orderId],
    );
    if (!payment || payment.provider !== expectedProvider)
      throw new AppError("Invalid payment provider", 400);
    const o = await order(orderId, tx);
    if (payment.status === "paid") return o;
    if (o.status !== "draft" || payment.amount !== o.total)
      throw new AppError("Order is not payable", 409);
    await tx.query(
      "UPDATE payments SET status=$2,provider_payment_id=CASE WHEN $2='paid' THEN $3 ELSE provider_payment_id END,paid_at=CASE WHEN $2='paid' THEN now() ELSE paid_at END,updated_at=now() WHERE order_id=$1",
      [orderId, success ? "paid" : "failed", paymentId],
    );
    await tx.query(
      "UPDATE orders SET payment_status=$2,status=CASE WHEN $2='paid' THEN 'confirmed' ELSE status END,updated_at=now() WHERE id=$1",
      [orderId, success ? "paid" : "failed"],
    );
    if (success) {
      const q = await queueEntry(o.queue_entry_id, tx);
      const shortId = o.id.slice(0, 8).toUpperCase();
      await enqueue(
        tx,
        q,
        "payment_successful",
        `Payment received ✅\n\n${money(o.total)} received for order ${shortId}.\nQueue: ${q.queue_number}\nThank you for dining with us!`,
        [money(o.total), shortId, q.queue_number],
        `paid:${o.id}`,
        o.id,
      );
      await enqueue(
        tx,
        q,
        "order_confirmed",
        `Your order is confirmed 🍽️\n\nOrder ${shortId}\n${o.items.map((i) => `${i.quantity} × ${i.name}`).join("\n")}\n\nOur kitchen will take it from here.`,
        [shortId, o.items.map((i) => `${i.quantity} x ${i.name}`).join(", ")],
        `order:${o.id}`,
        o.id,
      );
    }
    return order(orderId, tx);
  });
}
export async function mockComplete(orderId: string, success: boolean) {
  if (paymentProvider().name !== "mock")
    throw new AppError("Mock payments are disabled", 403);
  await startPayment(orderId);
  const o = await order(orderId);
  return finalizePayment(
    orderId,
    `mock_pay_${randomUUID()}`,
    success,
    o.total === 0 ? "credit" : "mock",
  );
}
export async function settleCredit(orderId: string) {
  const o = await order(orderId);
  if (o.total !== 0)
    throw new AppError("This order has an outstanding balance", 409);
  await startPayment(orderId);
  return finalizePayment(orderId, `credit_${orderId}`, true, "credit");
}
