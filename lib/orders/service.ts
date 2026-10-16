import { z } from "zod";
import { getDb, type Sql } from "../db";
import { orderSchema } from "../validation";
import { AppError } from "../utils/errors";
import { priceBenefits } from "../priority/service";
import { menuForRestaurantId } from "../menu/service";
import { discountForOrder } from "../customers/discounts";
import type { Order, OrderItem, QueueStatus, OrderStatus } from "@/types";
export async function menu(queueEntryId: string) {
  const db = await getDb();
  const [visit] = await db.query<{ restaurant_id: string }>(
    "SELECT restaurant_id FROM queue_entries WHERE id=$1",
    [queueEntryId],
  );
  if (!visit) throw new AppError("Queue entry not found", 404);
  return menuForRestaurantId(visit.restaurant_id, db);
}
export async function order(id: string, sql?: Sql) {
  const db = sql || (await getDb());
  const [row] = await db.query<Order>(
    `SELECT o.*,c.name,c.phone,q.queue_number FROM orders o JOIN customers c ON c.id=o.customer_id JOIN queue_entries q ON q.id=o.queue_entry_id WHERE o.id=$1`,
    [id],
  );
  if (!row) throw new AppError("Order not found", 404);
  row.items = await db.query<OrderItem>(
    "SELECT menu_item_id,name,quantity,unit_price,total_price FROM order_items WHERE order_id=$1 ORDER BY name",
    [id],
  );
  return row;
}
export async function createOrder(input: z.infer<typeof orderSchema>) {
  return (await getDb()).transaction(async (tx) => {
    const [q] = await tx.query<{
      restaurant_id: string;
      customer_id: string;
      status: QueueStatus;
    }>(
      "SELECT restaurant_id,customer_id,status FROM queue_entries WHERE id=$1 FOR UPDATE",
      [input.queueEntryId],
    );
    if (!q || ["completed", "cancelled"].includes(q.status))
      throw new AppError(
        "This visit is closed. Ask staff to start a new visit.",
        409,
      );
    const [existing] = await tx.query<{ id: string; queue_entry_id: string }>(
      "SELECT id,queue_entry_id FROM orders WHERE request_id=$1",
      [input.requestId],
    );
    if (existing) {
      if (existing.queue_entry_id !== input.queueEntryId)
        throw new AppError("Request already used", 409);
      return order(existing.id, tx);
    }
    await tx.query(
      "SELECT id FROM menu_items WHERE restaurant_id=$1 AND id=ANY($2::uuid[]) FOR SHARE",
      [q.restaurant_id, input.items.map((item) => item.menuItemId)],
    );
    const currentMenu = await menuForRestaurantId(q.restaurant_id, tx),
      available = new Map(currentMenu.map((item) => [item.id, item]));
    const items: OrderItem[] = [];
    for (const item of input.items) {
      const m = available.get(item.menuItemId);
      if (!m || !m.available)
        throw new AppError(
          "An item is no longer available. Please update your cart.",
          409,
        );
      items.push({
        menu_item_id: m.id,
        name: m.name,
        quantity: item.quantity,
        unit_price: m.price,
        total_price: m.price * item.quantity,
      });
    }
    const total = items.reduce((sum, i) => sum + i.total_price, 0);
    if (total > 10000000)
      throw new AppError("Order exceeds the ₹1,00,000 limit");
    const customerDiscount = await discountForOrder(
        tx,
        q.restaurant_id,
        q.customer_id,
        total,
      ),
      benefits = await priceBenefits(tx, input.queueEntryId, total),
      useCustomer =
        !!customerDiscount && customerDiscount.amount > benefits.discount,
      discount = useCustomer ? customerDiscount.amount : benefits.discount,
      discountReason = useCustomer ? customerDiscount.reason : benefits.reason,
      credit = Math.min(benefits.credit, total - discount);
    if (benefits.purchaseId && credit < benefits.credit)
      await tx.query(
        "UPDATE priority_purchases SET credit_used=credit_used-$2 WHERE id=$1",
        [benefits.purchaseId, benefits.credit - credit],
      );
    const [created] = await tx.query<{ id: string }>(
      "INSERT INTO orders(restaurant_id,customer_id,queue_entry_id,subtotal,total,request_id,discount_amount,discount_reason,credit_applied,priority_purchase_id,discount_record_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
      [
        q.restaurant_id,
        q.customer_id,
        input.queueEntryId,
        total,
        total - discount - credit,
        input.requestId,
        discount,
        discountReason,
        credit,
        benefits.purchaseId,
        useCustomer ? customerDiscount.id : null,
      ],
    );
    if (useCustomer)
      await tx.query(
        "UPDATE customer_discount_records SET used_at=now(),order_id=$2 WHERE id=$1",
        [customerDiscount.id, created.id],
      );
    for (const item of items)
      await tx.query(
        "INSERT INTO order_items(order_id,menu_item_id,name,quantity,unit_price,total_price) VALUES($1,$2,$3,$4,$5,$6)",
        [
          created.id,
          item.menu_item_id,
          item.name,
          item.quantity,
          item.unit_price,
          item.total_price,
        ],
      );
    return order(created.id, tx);
  });
}
export async function reviewOrder(id: string) {
  const result = await (
    await getDb()
  ).query(
    "UPDATE orders SET reviewed_at=now(),updated_at=now() WHERE id=$1 AND status='draft' RETURNING id",
    [id],
  );
  if (!result.length)
    throw new AppError("This order is no longer a draft", 409);
  return { ok: true };
}
export async function cancelDraft(id: string) {
  return (await getDb()).transaction(async (tx) => {
    const original = await order(id, tx);
    await tx.query("SELECT id FROM queue_entries WHERE id=$1 FOR UPDATE", [
      original.queue_entry_id,
    ]);
    await tx.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [id]);
    const o = await order(id, tx);
    if (o.status === "cancelled") return { ok: true };
    if (o.status !== "draft")
      throw new AppError("Only draft orders can be edited", 409);
    const [payment] = await tx.query(
      "SELECT id FROM payments WHERE order_id=$1",
      [id],
    );
    if (payment)
      throw new AppError(
        "Payment has already started. Finish this order or ask staff for help.",
        409,
      );
    await tx.query(
      "UPDATE priority_purchases SET credit_used=credit_used-$2 WHERE id=(SELECT priority_purchase_id FROM orders WHERE id=$1)",
      [id, o.credit_applied],
    );
    await tx.query(
      "UPDATE customer_discount_records SET used_at=NULL,order_id=NULL WHERE order_id=$1",
      [id],
    );
    await tx.query(
      "UPDATE orders SET status='cancelled',updated_at=now() WHERE id=$1",
      [id],
    );
    return { ok: true };
  });
}
export const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  draft: [],
  confirmed: ["preparing"],
  preparing: ["ready"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};
export async function changeOrder(id: string, status: OrderStatus) {
  return (await getDb()).transaction(async (tx) => {
    const [o] = await tx.query<{ status: OrderStatus; payment_status: string }>(
      "SELECT status,payment_status FROM orders WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!o) throw new AppError("Order not found", 404);
    if (o.payment_status !== "paid")
      throw new AppError("Only paid orders can be prepared", 409);
    if (o.status !== status && !orderTransitions[o.status].includes(status))
      throw new AppError(`Cannot change ${o.status} to ${status}`, 409);
    await tx.query("UPDATE orders SET status=$2,updated_at=now() WHERE id=$1", [
      id,
      status,
    ]);
    return order(id, tx);
  });
}
