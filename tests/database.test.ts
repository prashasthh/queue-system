import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db";
import {
  joinQueue,
  callNext,
  changeQueue,
  queueEntry,
} from "../lib/queue/service";
import { createOrder, reviewOrder, menu } from "../lib/orders/service";
import { mockComplete } from "../lib/payments/service";
import { flushMessages } from "../lib/whatsapp/outbox";
test("PostgreSQL transactions, pricing, outbox failure and payment invariants", async (t) => {
  process.env.DB_PROVIDER = "pglite";
  process.env.PGLITE_DATA_DIR = "memory://";
  process.env.PAYMENT_PROVIDER = "mock";
  const db = await getDb();
  try {
    const visits = await Promise.all(
      [1, 2, 3].map((n) =>
        joinQueue(
          {
            name: `Test Guest`,
            phone: `+91987654321${n}`,
            partySize: n,
            slug: "demo-restaurant",
            requestId: randomUUID(),
            consent: true,
          },
          "test-access-hash",
        ),
      ),
    );
    await t.test(
      "concurrent joins allocate unique sequential daily numbers",
      () => {
        assert.deepEqual(visits.map((q) => q.queue_number).sort(), [
          "Q001",
          "Q002",
          "Q003",
        ]);
        assert.equal(visits[2].people_ahead, 2);
        assert.equal(visits[2].estimated_minutes, 10);
      },
    );
    const calls = await Promise.all([callNext(), callNext(), callNext()]);
    await t.test(
      "concurrent call-next calls only the oldest party",
      async () => {
        assert(calls.every((q) => q.id === visits[0].id));
        const [count] = await db.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM queue_entries WHERE status='called'",
        );
        assert.equal(count.n, 1);
      },
    );
    await t.test("invalid queue transition is rejected", async () => {
      await assert.rejects(() => changeQueue(visits[1].id, "completed"));
    });
    const items = await menu(visits[0].id),
      fries = items.find((i) => i.name === "French Fries")!;
    await t.test("unavailable menu items cannot become orders", async () => {
      await db.query("UPDATE menu_items SET available=false WHERE id=$1", [
        fries.id,
      ]);
      await assert.rejects(() =>
        createOrder({
          queueEntryId: visits[0].id,
          requestId: randomUUID(),
          items: [{ menuItemId: fries.id, quantity: 1 }],
        }),
      );
      await db.query("UPDATE menu_items SET available=true WHERE id=$1", [
        fries.id,
      ]);
    });
    const input = {
      queueEntryId: visits[0].id,
      requestId: randomUUID(),
      items: [{ menuItemId: fries.id, quantity: 2 }],
    };
    const order = await createOrder(input);
    await t.test("order replay preserves server-priced snapshot", async () => {
      assert.equal(order.total, 24000);
      assert.equal((await createOrder(input)).id, order.id);
      await assert.rejects(() => mockComplete(order.id, true));
    });
    await reviewOrder(order.id);
    await mockComplete(order.id, false);
    const paid = await mockComplete(order.id, true);
    await t.test(
      "payment success is final and notifications enqueue once",
      async () => {
        assert.equal(paid.status, "confirmed");
        await mockComplete(order.id, true);
        assert.equal(
          (await mockComplete(order.id, false)).payment_status,
          "paid",
        );
        const [count] = await db.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM whatsapp_messages WHERE order_id=$1",
          [order.id],
        );
        assert.equal(count.n, 2);
      },
    );
    await t.test(
      "WhatsApp outage preserves committed visits and paid orders",
      async () => {
        process.env.WHATSAPP_PROVIDER = "meta";
        delete process.env.META_WHATSAPP_TOKEN;
        await flushMessages();
        const [count] = await db.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM whatsapp_messages WHERE status='failed'",
        );
        assert.equal(count.n, 6);
        assert.equal((await queueEntry(visits[0].id)).status, "called");
        const [saved] = await db.query<{ payment_status: string }>(
          "SELECT payment_status FROM orders WHERE id=$1",
          [order.id],
        );
        assert.equal(saved.payment_status, "paid");
      },
    );
    await t.test(
      "failed order on cancelled visit cannot be charged",
      async () => {
        const draft = await createOrder({
          ...input,
          queueEntryId: visits[1].id,
          requestId: randomUUID(),
        });
        await reviewOrder(draft.id);
        await mockComplete(draft.id, false);
        await changeQueue(visits[1].id, "cancelled");
        await assert.rejects(() => mockComplete(draft.id, true));
      },
    );
  } finally {
    await db.close();
  }
});
