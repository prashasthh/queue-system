import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db";
import {
  callNext,
  changeQueue,
  joinQueue,
  queueEntry,
} from "../lib/queue/service";
import { createReservation } from "../lib/reservations/service";
import { arriveReservation } from "../lib/reservations/arrival";
import { changeTable, floor } from "../lib/tables/service";

test("floor allocation preserves reservations and enforces table states", async () => {
  process.env.DB_PROVIDER = "pglite";
  process.env.PGLITE_DATA_DIR = "memory://";
  const db = await getDb();
  const restaurantId = "00000000-0000-4000-8000-000000000001";
  try {
    await db.query(
      "UPDATE restaurant_settings SET opening_time='00:00',closing_time='23:59' WHERE restaurant_id=$1",
      [restaurantId],
    );
    const now = new Date();
    const startsAt = new Date(now.getTime() + 60 * 60000);
    const booking = await createReservation(
      {
        name: "Reserved Guest",
        phone: "+919811111111",
        partySize: 3,
        slug: "demo-restaurant",
        requestId: randomUUID(),
        consent: true,
        startsAt: startsAt.toISOString(),
        notes: "Smallest suitable table",
      },
      "reservation-access",
      now,
    );
    assert.equal(booking.table_number, "T2");

    const walkIn = await joinQueue(
      {
        name: "Walk In Guest",
        phone: "+919822222222",
        partySize: 3,
        slug: "demo-restaurant",
        requestId: randomUUID(),
        consent: true,
      },
      "walk-in-access",
    );
    const called = await callNext();
    assert.equal(called.id, walkIn.id);
    assert.equal(called.table_number, "T4");

    const table = (await floor(restaurantId)).find(
      (candidate) => candidate.table_number === "T4",
    )!;
    await assert.rejects(
      changeTable(table.id, "available", "test"),
      /Complete or cancel/,
    );
    await changeQueue(walkIn.id, "seated");
    assert.equal(
      (await floor(restaurantId)).find((candidate) => candidate.id === table.id)
        ?.status,
      "occupied",
    );
    for (const status of [
      "ordering",
      "preparing",
      "dining",
      "payment_pending",
    ] as const)
      await changeTable(table.id, status, "test");
    await changeQueue(walkIn.id, "completed");
    assert.equal(
      (await floor(restaurantId)).find((candidate) => candidate.id === table.id)
        ?.status,
      "cleaning",
    );
    await changeTable(table.id, "available", "test");

    const arrival = await arriveReservation(
      booking.id,
      "test",
      new Date(startsAt.getTime() - 10 * 60000),
    );
    assert.equal(
      (await arriveReservation(booking.id, "test", startsAt)).id,
      arrival.id,
    );
    await db.query(
      "UPDATE queue_entries SET called_at=now()-interval '4 seconds' WHERE id=$1",
      [walkIn.id],
    );
    assert.equal((await callNext()).id, arrival.id);
    assert.equal((await queueEntry(arrival.id)).table_number, "T2");

    const next = await joinQueue(
      {
        name: "Next Guest",
        phone: "+919833333333",
        partySize: 2,
        slug: "demo-restaurant",
        requestId: randomUUID(),
        consent: true,
      },
      "next-access",
    );
    await changeQueue(arrival.id, "cancelled");
    assert.equal((await queueEntry(next.id)).status, "called");
    assert.equal((await queueEntry(next.id)).table_number, "T1");
    assert(
      (
        await db.query<{ action: string }>("SELECT action FROM audit_events")
      ).some((event) => event.action === "table_transition"),
    );
  } finally {
    await db.close();
  }
});
