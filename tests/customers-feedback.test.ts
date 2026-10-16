import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db";
import { callNext, changeQueue, joinQueue } from "../lib/queue/service";
import { cancelDraft, createOrder, reviewOrder } from "../lib/orders/service";
import { mockComplete } from "../lib/payments/service";
import { submitFeedback } from "../lib/feedback/service";
import { customerDetail, customerProfiles } from "../lib/customers/service";

test("feedback history creates auditable deterministic recovery discounts", async () => {
  process.env.DB_PROVIDER = "pglite";
  process.env.PGLITE_DATA_DIR = "memory://";
  process.env.PAYMENT_PROVIDER = "mock";
  const db = await getDb();
  const restaurantId = "00000000-0000-4000-8000-000000000001";
  try {
    const [water] = await db.query<{ id: string }>(
      "SELECT id FROM menu_items WHERE name='Water'",
    );
    const first = await joinQueue(
      {
        name: "Loyal Guest",
        phone: "+919855555555",
        partySize: 2,
        slug: "demo-restaurant",
        requestId: randomUUID(),
        consent: true,
      },
      "loyal-one",
    );
    await callNext();
    const paidOrder = await createOrder({
      queueEntryId: first.id,
      requestId: randomUUID(),
      items: [{ menuItemId: water.id, quantity: 10 }],
    });
    await reviewOrder(paidOrder.id);
    await mockComplete(paidOrder.id, true);
    await changeQueue(first.id, "seated");
    await changeQueue(first.id, "completed");
    const feedback = await submitFeedback(first.id, {
      foodQualityRating: 2,
      serviceRating: 2,
      waitingTimeRating: 2,
      cleanlinessRating: 2,
      comment: "Please follow up.",
    });
    assert.equal(feedback.duplicate, false);
    assert.equal(
      (
        await submitFeedback(first.id, {
          foodQualityRating: 5,
          serviceRating: 5,
          waitingTimeRating: 5,
          cleanlinessRating: 5,
          comment: "Replay",
        })
      ).duplicate,
      true,
    );

    const second = await joinQueue(
      {
        name: "Loyal Guest",
        phone: "+919855555555",
        partySize: 2,
        slug: "demo-restaurant",
        requestId: randomUUID(),
        consent: true,
      },
      "loyal-two",
    );
    const discounted = await createOrder({
      queueEntryId: second.id,
      requestId: randomUUID(),
      items: [{ menuItemId: water.id, quantity: 1 }],
    });
    assert.equal(discounted.subtotal, 2000);
    assert.equal(discounted.discount_amount, 200);
    assert.match(discounted.discount_reason, /recovery/i);
    const [record] = await db.query<{
      discount_type: string;
      used_at: string | null;
      order_id: string | null;
    }>(
      "SELECT discount_type,used_at,order_id FROM customer_discount_records WHERE order_id=$1",
      [discounted.id],
    );
    assert.equal(record.discount_type, "recovery");
    assert(record.used_at);
    await cancelDraft(discounted.id);
    const [released] = await db.query<{ used_at: string | null }>(
      "SELECT used_at FROM customer_discount_records WHERE id=(SELECT discount_record_id FROM orders WHERE id=$1)",
      [discounted.id],
    );
    assert.equal(released.used_at, null);

    const [profile] = await customerProfiles(restaurantId, "9855555555");
    assert.equal(profile.completed_visits, 1);
    assert.equal(profile.total_spend, 20000);
    assert.equal(profile.average_feedback, 2);
    const detail = await customerDetail(restaurantId, profile.id);
    assert.equal(detail.feedback.length, 1);
    assert.equal((detail.favorites[0] as { name: string }).name, "Water");
    const [messages] = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM whatsapp_messages WHERE queue_entry_id=$1 AND message_type='feedback_request'",
      [first.id],
    );
    assert.equal(messages.count, 1);
  } finally {
    await db.close();
  }
});
