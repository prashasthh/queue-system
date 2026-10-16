import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/utils/errors";
import { finalizePayment } from "./service";
import { audit } from "@/lib/audit";
import { RazorpayPaymentProvider } from "./razorpay";

export const rangeSchema = z
  .object({ from: z.string().date(), to: z.string().date() })
  .refine((v) => v.from <= v.to, "Invalid date range");
export const refundSchema = z
  .object({
    paymentId: z.string().uuid(),
    amount: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export const manualDiscountSchema = z
  .object({
    orderId: z.string().uuid(),
    type: z.enum(["percentage", "fixed"]),
    value: z.number().int().positive(),
    reason: z.string().trim().min(3).max(200),
  })
  .strict();

export async function paymentDashboard(
  restaurantId: string,
  from: string,
  to: string,
) {
  rangeSchema.parse({ from, to });
  const db = await getDb();
  const [metrics] = await db.query<Record<string, number>>(
    `SELECT
    coalesce(sum(p.amount) FILTER(WHERE p.status IN ('paid','refunded')),0)::int gross_sales,
    (coalesce(sum(p.amount) FILTER(WHERE p.status IN ('paid','refunded')),0)-coalesce((SELECT sum(r.amount) FROM refunds r WHERE r.restaurant_id=$1 AND r.status='completed' AND r.created_at >= $2::date AND r.created_at < $3::date+1),0))::int net_sales,
    coalesce(sum(p.amount) FILTER(WHERE p.status IN ('paid','refunded') AND p.method<>'cash'),0)::int online_payments,
    coalesce(sum(p.amount) FILTER(WHERE p.status IN ('paid','refunded') AND p.method='cash'),0)::int cash_payments,
    count(DISTINCT p.order_id) FILTER(WHERE p.status IN ('paid','refunded'))::int total_orders,
    coalesce((SELECT sum(r.amount) FROM refunds r WHERE r.restaurant_id=$1 AND r.status='completed' AND r.created_at >= $2::date AND r.created_at < $3::date+1),0)::int refunds,
    coalesce(sum(o.discount_amount) FILTER(WHERE p.status IN ('paid','refunded')),0)::int discounts,
    coalesce(sum(o.discount_amount) FILTER(WHERE p.status IN ('paid','refunded') AND o.discount_reason LIKE 'Manual:%'),0)::int manual_discounts,
    coalesce(sum(o.discount_amount) FILTER(WHERE p.status IN ('paid','refunded') AND o.discount_reason ILIKE '%VIP%'),0)::int vip_discounts,
    coalesce(sum(o.discount_amount) FILTER(WHERE p.status IN ('paid','refunded') AND o.discount_reason<>'' AND o.discount_reason NOT LIKE 'Manual:%' AND o.discount_reason NOT ILIKE '%VIP%'),0)::int personalized_discounts,
    coalesce(avg(o.total) FILTER(WHERE p.status IN ('paid','refunded') AND p.order_id IS NOT NULL),0)::int average_order_value,
    coalesce(sum(p.amount) FILTER(WHERE p.purpose='vip_priority' AND p.status IN ('paid','refunded')),0)::int vip_fees,
    coalesce(sum(p.amount) FILTER(WHERE p.purpose='commitment_deposit' AND p.status IN ('paid','refunded')),0)::int commitment_deposits
    FROM payments p LEFT JOIN orders o ON o.id=p.order_id LEFT JOIN priority_purchases pp ON pp.id=p.priority_purchase_id
    WHERE coalesce(o.restaurant_id,pp.restaurant_id)=$1 AND p.created_at >= $2::date AND p.created_at < $3::date+1`,
    [restaurantId, from, to],
  );
  const payments = await db.query(
    `SELECT p.*,o.total,o.subtotal,o.discount_amount,o.discount_reason,c.name customer_name,c.phone FROM payments p LEFT JOIN orders o ON o.id=p.order_id LEFT JOIN queue_entries q ON q.id=o.queue_entry_id LEFT JOIN customers c ON c.id=q.customer_id LEFT JOIN priority_purchases pp ON pp.id=p.priority_purchase_id WHERE coalesce(o.restaurant_id,pp.restaurant_id)=$1 AND p.created_at >= $2::date AND p.created_at < $3::date+1 ORDER BY p.created_at DESC LIMIT 200`,
    [restaurantId, from, to],
  );
  const refunds = await db.query(
    `SELECT r.*,p.method,p.provider FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE r.restaurant_id=$1 AND r.created_at >= $2::date AND r.created_at < $3::date+1 ORDER BY r.created_at DESC`,
    [restaurantId, from, to],
  );
  const outstanding = await db.query(
    `SELECT o.id,o.total,o.subtotal,o.discount_amount,o.discount_reason,o.created_at,c.name customer_name FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.restaurant_id=$1 AND o.payment_status IN ('pending','failed') AND o.status='draft' ORDER BY o.created_at DESC LIMIT 100`,
    [restaurantId],
  );
  return { metrics, payments, refunds, outstanding };
}
export async function receiveCash(
  restaurantId: string,
  orderId: string,
  staffId: string | null,
) {
  const db = await getDb();
  const paymentId = `cash_${randomUUID()}`;
  await db.transaction(async (tx) => {
    const [o] = await tx.query<{
      total: number;
      reviewed_at: string | null;
      status: string;
      payment_status: string;
    }>(
      "SELECT total,reviewed_at,status,payment_status FROM orders WHERE id=$1 AND restaurant_id=$2 FOR UPDATE",
      [orderId, restaurantId],
    );
    if (!o) throw new AppError("Order not found", 404);
    if (!o.reviewed_at)
      throw new AppError("Order must be reviewed before collecting cash", 409);
    if (o.status !== "draft" || o.payment_status === "paid")
      throw new AppError("Order is not payable", 409);
    const [existing] = await tx.query<{ id: string; status: string }>(
      "SELECT id,status FROM payments WHERE order_id=$1 FOR UPDATE",
      [orderId],
    );
    if (existing)
      throw new AppError(
        "A payment attempt already exists for this order",
        409,
      );
    await tx.query(
      "INSERT INTO payments(order_id,provider,provider_order_id,amount,status,purpose,method,recorded_by) VALUES($1,'cash',$2,$3,'pending','food_order','cash',$4)",
      [orderId, paymentId, o.total, staffId],
    );
  });
  const result = await finalizePayment(orderId, paymentId, true, "cash");
  await db.transaction((tx) =>
    audit(
      tx,
      restaurantId,
      staffId || "bootstrap-owner",
      "cash_payment",
      orderId,
      { amount: result.total },
    ),
  );
  await db.query(
    "UPDATE payments SET paid_at=coalesce(paid_at,now()) WHERE order_id=$1",
    [orderId],
  );
  return result;
}
export async function applyManualDiscount(
  restaurantId: string,
  raw: unknown,
  staffId: string | null,
) {
  const v = manualDiscountSchema.parse(raw);
  return (await getDb()).transaction(async (tx) => {
    const [o] = await tx.query<{
      subtotal: number;
      credit_applied: number;
      status: string;
      payment_status: string;
    }>(
      "SELECT subtotal,credit_applied,status,payment_status FROM orders WHERE id=$1 AND restaurant_id=$2 FOR UPDATE",
      [v.orderId, restaurantId],
    );
    if (!o) throw new AppError("Order not found", 404);
    if (o.status !== "draft" || o.payment_status === "paid")
      throw new AppError("Only unpaid draft orders can be discounted", 409);
    const [payment] = await tx.query(
      "SELECT id FROM payments WHERE order_id=$1",
      [v.orderId],
    );
    if (payment)
      throw new AppError("Discounts cannot change after payment starts", 409);
    const discount =
      v.type === "percentage"
        ? Math.floor((o.subtotal * Math.min(v.value, 100)) / 100)
        : Math.min(v.value, o.subtotal);
    const total = Math.max(0, o.subtotal - discount - o.credit_applied);
    await tx.query(
      "UPDATE orders SET discount_amount=$2,discount_reason=$3,total=$4,discount_record_id=NULL,updated_at=now() WHERE id=$1",
      [v.orderId, discount, `Manual: ${v.reason}`, total],
    );
    await tx.query(
      "UPDATE customer_discount_records SET used_at=NULL,order_id=NULL WHERE order_id=$1",
      [v.orderId],
    );
    await audit(
      tx,
      restaurantId,
      staffId || "bootstrap-owner",
      "manual_discount",
      v.orderId,
      { discount, reason: v.reason },
    );
    return { orderId: v.orderId, discount, total };
  });
}

export async function createRefund(
  restaurantId: string,
  raw: unknown,
  staffId: string | null,
) {
  const v = refundSchema.parse(raw);
  return (await getDb()).transaction(async (tx) => {
    const [p] = await tx.query<{
      id: string;
      order_id: string | null;
      priority_purchase_id: string | null;
      amount: number;
      status: string;
      provider: string;
      provider_payment_id: string | null;
    }>(
      "SELECT id,order_id,priority_purchase_id,amount,status,provider,provider_payment_id FROM payments WHERE id=$1 FOR UPDATE",
      [v.paymentId],
    );
    if (!p) throw new AppError("Payment not found", 404);
    const [owner] = await tx.query<{ restaurant_id: string }>(
      "SELECT restaurant_id FROM orders WHERE id=$1 UNION ALL SELECT restaurant_id FROM priority_purchases WHERE id=$2",
      [p.order_id, p.priority_purchase_id],
    );
    if (owner?.restaurant_id !== restaurantId)
      throw new AppError("Payment not found", 404);
    if (!["paid", "refunded"].includes(p.status))
      throw new AppError("Only successful payments can be refunded", 409);
    const [sum] = await tx.query<{ amount: number }>(
      "SELECT coalesce(sum(amount),0)::int amount FROM refunds WHERE payment_id=$1 AND status='completed'",
      [p.id],
    );
    if (sum.amount + v.amount > p.amount)
      throw new AppError("Refund exceeds the remaining paid amount", 409);
    const providerId =
      p.provider === "razorpay"
        ? p.provider_payment_id
          ? (
              await new RazorpayPaymentProvider().refund(
                p.provider_payment_id,
                v.amount,
                v.reason,
              )
            ).id
          : (() => {
              throw new AppError("Razorpay payment ID is missing", 409);
            })()
        : `${p.provider}_refund_${randomUUID()}`;
    const [refund] = await tx.query<{
      id: string;
      amount: number;
      reason: string;
    }>(
      "INSERT INTO refunds(restaurant_id,payment_id,order_id,priority_purchase_id,amount,reason,staff_user_id,provider_refund_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [
        restaurantId,
        p.id,
        p.order_id,
        p.priority_purchase_id,
        v.amount,
        v.reason,
        staffId,
        providerId,
      ],
    );
    if (sum.amount + v.amount === p.amount) {
      await tx.query(
        "UPDATE payments SET status='refunded',updated_at=now() WHERE id=$1",
        [p.id],
      );
      if (p.order_id)
        await tx.query(
          "UPDATE orders SET payment_status='refunded',updated_at=now() WHERE id=$1",
          [p.order_id],
        );
      if (p.priority_purchase_id)
        await tx.query(
          "UPDATE priority_purchases SET payment_status='refunded' WHERE id=$1",
          [p.priority_purchase_id],
        );
    }
    await audit(
      tx,
      restaurantId,
      staffId || "bootstrap-owner",
      "refund",
      refund.id,
      { paymentId: p.id, amount: v.amount, reason: v.reason },
    );
    return refund;
  });
}
