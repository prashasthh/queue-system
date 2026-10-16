import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db";
import { joinQueue, callNext } from "../lib/queue/service";
import {
  createPriority,
  priorityOffer,
  reviewPriority,
  purchase,
} from "../lib/priority/service";
import { mockPriority } from "../lib/priority/payments";
import { createOrder, reviewOrder, cancelDraft } from "../lib/orders/service";
import { mockComplete, settleCredit } from "../lib/payments/service";
test("reviewed priority payments, ranking, discounts and deposit conservation", async () => {
  process.env.PGLITE_DATA_DIR = "memory://";
  process.env.PAYMENT_PROVIDER = "mock";
  const db = await getDb();
  try {
    const visits = [];
    for (let i = 0; i < 4; i++)
      visits.push(
        await joinQueue(
          {
            name: "Priority Guest",
            phone: `+91987654321${i}`,
            partySize: 3,
            slug: "demo-restaurant",
            requestId: randomUUID(),
            consent: true,
          },
          "test",
        ),
      );
    const vip = await createPriority("queue", visits[1].id, "vip");
    assert.equal((await priorityOffer("queue", visits[1].id)).eligible, true);
    await assert.rejects(mockPriority(vip.id, true), /Review/);
    await reviewPriority(vip.id);
    await mockPriority(vip.id, false);
    assert.equal((await purchase(vip.id)).payment_status, "failed");
    await mockPriority(vip.id, true);
    await mockPriority(vip.id, false);
    assert.equal((await purchase(vip.id)).payment_status, "paid");
    assert.equal(
      (await db.query<{ status: string }>("SELECT status FROM queue_entries WHERE id=$1", [visits[1].id]))[0].status,
      "called",
    );
    assert.deepEqual(await priorityOffer("queue", visits[1].id), {
      status: "called",
      restaurantSlug: "demo-restaurant",
      eligible: false,
      paidPriority: "vip",
      options: await (async () => {
        const offer = await priorityOffer("queue", visits[0].id);
        return offer.options;
      })(),
    });
    assert.equal((await callNext()).id, visits[1].id);
    const [item] = await db.query<{ id: string }>(
      "SELECT id FROM menu_items WHERE name='Water'",
    );
    const discounted = await createOrder({
      queueEntryId: visits[1].id,
      requestId: randomUUID(),
      items: [{ menuItemId: item.id, quantity: 10 }],
    });
    assert.equal(discounted.subtotal, 20000);
    assert.equal(discounted.discount_amount, 3000);
    assert.equal(discounted.total, 17000);
    const deposit = await createPriority("queue", visits[2].id, "commitment");
    await reviewPriority(deposit.id);
    await mockPriority(deposit.id, true);
    await db.query("UPDATE menu_items SET price=80000 WHERE id=$1", [item.id]);
    const input = {
      queueEntryId: visits[2].id,
      requestId: randomUUID(),
      items: [{ menuItemId: item.id, quantity: 2 }],
    };
    const o = await createOrder(input);
    assert.equal(o.subtotal, 160000);
    assert.equal(o.credit_applied, 100000);
    assert.equal(o.total, 60000);
    assert.equal((await createOrder(input)).id, o.id);
    assert.equal((await purchase(deposit.id)).credit_used, 100000);
    await cancelDraft(o.id);
    assert.equal((await purchase(deposit.id)).credit_used, 0);
    const next = await createOrder({ ...input, requestId: randomUUID() });
    await reviewOrder(next.id);
    await mockComplete(next.id, true);
    assert.equal((await purchase(deposit.id)).credit_used, 100000);
    const deposit2 = await createPriority("queue", visits[3].id, "commitment");
    await reviewPriority(deposit2.id);
    await mockPriority(deposit2.id, true);
    await db.query("UPDATE menu_items SET price=85000 WHERE id=$1", [item.id]);
    const low = await createOrder({
      queueEntryId: visits[3].id,
      requestId: randomUUID(),
      items: [{ menuItemId: item.id, quantity: 1 }],
    });
    assert.equal(low.total, 0);
    assert.equal(low.credit_applied, 85000);
    await reviewOrder(low.id);
    await settleCredit(low.id);
    await settleCredit(low.id);
    assert.equal((await purchase(deposit2.id)).amount, 100000);
    assert.equal(
      (
        await db.query<{ total: number }>(
          "SELECT sum(amount)::int AS total FROM payments WHERE priority_purchase_id=$1 AND status='paid'",
          [deposit2.id],
        )
      )[0].total,
      100000,
    );
  } finally {
    await db.close();
  }
});
