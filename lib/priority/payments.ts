import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { purchase } from "./service";
import { paymentProvider } from "../payments";
import type { PaymentRecord } from "../payments/provider";
import { AppError } from "../utils/errors";
import { money } from "../utils/format";
import { autoAllocate } from "../tables/service";
export async function startPriorityPayment(id: string) {
  return (await getDb()).transaction(async (tx) => {
    await tx.query("SELECT id FROM priority_purchases WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    const p = await purchase(id, tx);
    if (!p.reviewed_at)
      throw new AppError("Review this fee before payment", 409);
    const [existing] = await tx.query<PaymentRecord>(
      "SELECT * FROM payments WHERE priority_purchase_id=$1",
      [id],
    );
    if (existing?.status === "paid") return existing;
    const [visit] = await tx.query<{ status: string }>(
      `SELECT status FROM ${p.queue_entry_id ? "queue_entries" : "reservations"} WHERE id=$1`,
      [p.queue_entry_id || p.reservation_id],
    );
    if (
      !visit ||
      ![
        "waiting",
        "pending",
        "confirmed",
        "reminder_sent",
        "awaiting_confirmation",
      ].includes(visit.status)
    )
      throw new AppError("This visit is no longer eligible for priority", 409);
    if (existing) {
      if (existing.provider !== paymentProvider().name)
        throw new AppError("Payment provider changed. Contact staff.", 409);
      return existing;
    }
    const provider = paymentProvider(),
      result = await provider.create(p.amount, id);
    return (
      await tx.query<PaymentRecord>(
        "INSERT INTO payments(priority_purchase_id,provider,provider_order_id,amount,purpose) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [
          id,
          provider.name,
          result.id,
          p.amount,
          p.priority_type === "vip" ? "vip_priority" : "commitment_deposit",
        ],
      )
    )[0];
  });
}
export async function finalizePriority(
  id: string,
  paymentId: string,
  success: boolean,
  provider: "mock" | "razorpay",
) {
  return (await getDb()).transaction(async (tx) => {
    await tx.query("SELECT id FROM priority_purchases WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    const p = await purchase(id, tx);
    const [payment] = await tx.query<PaymentRecord>(
      "SELECT * FROM payments WHERE priority_purchase_id=$1 FOR UPDATE",
      [id],
    );
    if (
      !payment ||
      payment.provider !== provider ||
      payment.amount !== p.amount ||
      !p.reviewed_at
    )
      throw new AppError("Invalid priority payment", 400);
    if (payment.status === "paid") return p;
    await tx.query(
      "UPDATE payments SET status=$2,provider_payment_id=CASE WHEN $2='paid' THEN $3 ELSE provider_payment_id END,paid_at=CASE WHEN $2='paid' THEN now() ELSE paid_at END,updated_at=now() WHERE id=$1",
      [payment.id, success ? "paid" : "failed", paymentId],
    );
    await tx.query(
      "UPDATE priority_purchases SET payment_status=$2 WHERE id=$1",
      [id, success ? "paid" : "failed"],
    );
    if (success) {
      for (const [table, target] of [
        ["queue_entries", p.queue_entry_id],
        ["reservations", p.reservation_id],
      ])
        if (target)
          await tx.query(
            `UPDATE ${table} SET priority_type=$2,priority_weight=$3 WHERE id=$1`,
            [target, p.priority_type, p.weight],
          );
      await tx.query(
        "INSERT INTO whatsapp_messages(customer_id,queue_entry_id,reservation_id,phone,message_type,message,template_parameters,event_key) VALUES($1,$2,$3,$4,'payment_successful',$5,$6::jsonb,$7) ON CONFLICT(event_key) DO NOTHING",
        [
          p.customer_id,
          p.queue_entry_id,
          p.reservation_id,
          p.phone,
          `${money(p.amount)} received for ${p.priority_type} priority at ${p.restaurant_name}.`,
          JSON.stringify([money(p.amount), p.id.slice(0, 8), p.priority_type]),
          `priority-paid:${id}`,
        ],
      );
      // A paid walk-in becomes the first eligible party immediately. If a suitable
      // table is free, allocation also changes the visit to called in this transaction.
      if (p.queue_entry_id) await autoAllocate(tx, p.restaurant_id);
    }
    return purchase(id, tx);
  });
}
export async function mockPriority(id: string, success: boolean) {
  if (paymentProvider().name !== "mock")
    throw new AppError("Mock payments disabled", 403);
  await startPriorityPayment(id);
  return finalizePriority(id, `mock_priority_${randomUUID()}`, success, "mock");
}
