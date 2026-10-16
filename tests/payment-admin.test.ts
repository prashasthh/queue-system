import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db";
import { joinQueue } from "../lib/queue/service";
import { createOrder, reviewOrder } from "../lib/orders/service";
import {
  applyManualDiscount,
  createRefund,
  paymentDashboard,
  receiveCash,
} from "../lib/payments/admin";

test("cash, discounts, refunds and net sales remain auditable", async () => {
  process.env.DB_PROVIDER = "pglite";
  process.env.PGLITE_DATA_DIR = "memory://";
  process.env.WHATSAPP_PROVIDER = "mock";
  const db = await getDb(),
    restaurantId = "00000000-0000-4000-8000-000000000001";
  try {
    const [item] = await db.query<{ id: string }>(
      "SELECT id FROM menu_items WHERE name='French Fries'",
    );
    const visit = await joinQueue(
      {
        name: "Cash Guest",
        phone: "+919811111119",
        partySize: 2,
        slug: "demo-restaurant",
        requestId: randomUUID(),
        consent: true,
      },
      "cash-guest",
    );
    const order = await createOrder({
      queueEntryId: visit.id,
      requestId: randomUUID(),
      items: [{ menuItemId: item.id, quantity: 2 }],
    });
    const adjusted = await applyManualDiscount(
      restaurantId,
      {
        orderId: order.id,
        type: "percentage",
        value: 10,
        reason: "Opening offer",
      },
      null,
    );
    assert.equal(adjusted.discount, 2400);
    assert.equal(adjusted.total, 21600);
    await reviewOrder(order.id);
    await receiveCash(restaurantId, order.id, null);
    const [payment] = await db.query<{
      id: string;
      method: string;
      status: string;
      amount: number;
    }>("SELECT id,method,status,amount FROM payments WHERE order_id=$1", [
      order.id,
    ]);
    assert.equal(payment.method, "cash");
    assert.equal(payment.status, "paid");
    await createRefund(
      restaurantId,
      { paymentId: payment.id, amount: 5000, reason: "Service recovery" },
      null,
    );
    const today = new Date().toISOString().slice(0, 10),
      dashboard = await paymentDashboard(restaurantId, today, today);
    assert.equal(dashboard.metrics.gross_sales, 21600);
    assert.equal(dashboard.metrics.refunds, 5000);
    assert.equal(dashboard.metrics.net_sales, 16600);
    assert.equal(dashboard.metrics.manual_discounts, 2400);
    assert.equal(
      (await db.query("SELECT id FROM payments WHERE id=$1", [payment.id]))
        .length,
      1,
    );
  } finally {
    await db.close();
  }
});
