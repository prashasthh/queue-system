import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb, migrate } from "../lib/db";
import { createReservation, isOpenAt } from "../lib/reservations/service";
import { settings, updateSettings } from "../lib/settings/service";
import {
  processReservations,
  confirmReservation,
} from "../lib/reservations/lifecycle";
test("reservations preserve data and enforce hours, capacity and idempotency", async () => {
  process.env.PGLITE_DATA_DIR = "memory://";
  const db = await getDb();
  try {
    const id = "00000000-0000-4000-8000-000000000001",
      now = new Date("2026-10-10T04:00:00Z");
    const input = {
      name: "Reservation Guest",
      phone: "+919876543210",
      partySize: 3,
      slug: "demo-restaurant",
      requestId: randomUUID(),
      consent: true as const,
      startsAt: "2026-10-11T07:00:00Z",
      notes: "Window please",
    };
    const row = await createReservation(input, "owner", now);
    assert.equal(row.status, "pending");
    assert.equal((await createReservation(input, "owner", now)).id, row.id);
    await assert.rejects(
      createReservation(input, "stranger", now),
      /already used/,
    );
    await assert.rejects(
      createReservation({ ...input, requestId: randomUUID() }, "owner", now),
      /already has/,
    );
    await assert.rejects(
      createReservation(
        { ...input, requestId: randomUUID(), startsAt: "2026-10-09T07:00:00Z" },
        "owner",
        now,
      ),
      /future/,
    );
    await assert.rejects(
      createReservation(
        { ...input, requestId: randomUUID(), startsAt: "2026-10-11T18:00:00Z" },
        "owner",
        now,
      ),
      /closing/,
    );
    const s = await settings(id);
    const {
      restaurant_id: unused,
      updated_at: unused2,
      currency: unused3,
      ...editable
    } = s as typeof s & {
      restaurant_id: string;
      updated_at: string;
      currency: string;
    };
    void unused;
    void unused2;
    void unused3;
    await updateSettings(id, { ...editable, reservation_capacity: 3 });
    await assert.rejects(
      createReservation(
        { ...input, phone: "+919876543211", requestId: randomUUID() },
        "other",
        now,
      ),
      /fully booked/,
    );
    await migrate(db);
    assert.equal((await db.query("SELECT id FROM reservations")).length, 1);
    assert.equal(
      isOpenAt(
        new Date("2026-10-11T19:00:00Z"),
        "Asia/Kolkata",
        "18:00",
        "02:00",
      ),
      true,
    );
    assert.equal(
      isOpenAt(
        new Date("2026-10-11T08:00:00Z"),
        "Asia/Kolkata",
        "18:00",
        "02:00",
      ),
      false,
    );
    assert.equal(
      (await processReservations(new Date("2026-10-11T06:49:00Z"))).reminders,
      0,
    );
    assert.equal(
      (await processReservations(new Date("2026-10-11T06:50:00Z"))).reminders,
      1,
    );
    assert.equal(
      (await processReservations(new Date("2026-10-11T06:50:00Z"))).reminders,
      0,
    );
    assert.equal(
      (await processReservations(new Date("2026-10-11T06:55:00Z"))).reminders,
      1,
    );
    await confirmReservation(row.id, "yes", new Date("2026-10-11T06:56:00Z"));
    assert.equal(
      (await processReservations(new Date("2026-10-11T07:00:00Z"))).expired,
      0,
    );
    const unconfirmed = await createReservation(
      { ...input, requestId: randomUUID(), startsAt: "2026-10-12T07:00:00Z" },
      "owner",
      now,
    );
    await processReservations(new Date("2026-10-12T06:50:00Z"));
    await processReservations(new Date("2026-10-12T06:55:00Z"));
    await processReservations(new Date("2026-10-12T07:10:00Z"));
    assert.equal(
      (
        await db.query<{ status: string }>(
          "SELECT status FROM reservations WHERE id=$1",
          [unconfirmed.id],
        )
      )[0].status,
      "expired",
    );
    await assert.rejects(
      confirmReservation(
        unconfirmed.id,
        "yes",
        new Date("2026-10-12T07:11:00Z"),
      ),
      /no longer/,
    );
  } finally {
    await db.close();
  }
});
