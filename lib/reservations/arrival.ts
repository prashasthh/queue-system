import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { reservation } from "./service";
import { joinQueue, queueEntry } from "../queue/service";
import { lockRestaurant } from "../tables/service";
import { AppError } from "../utils/errors";
import { audit } from "../audit";
export async function arriveReservation(
  id: string,
  actor: string,
  now = new Date(),
) {
  return (await getDb()).transaction(async (tx) => {
    const original = await reservation(id, tx);
    await lockRestaurant(tx, original.restaurant_id);
    await tx.query("SELECT id FROM reservations WHERE id=$1 FOR UPDATE", [id]);
    const r = await reservation(id, tx);
    if (r.queue_entry_id) return queueEntry(r.queue_entry_id, tx);
    if (
      ![
        "pending",
        "confirmed",
        "reminder_sent",
        "awaiting_confirmation",
      ].includes(r.status)
    )
      throw new AppError("This reservation is no longer active", 409);
    if (
      now.getTime() < new Date(r.starts_at).getTime() - 30 * 60000 ||
      now.getTime() > new Date(r.ends_at).getTime()
    )
      throw new AppError(
        "Arrival can be recorded from 30 minutes before the booking until its end",
        409,
      );
    const [restaurant] = await tx.query<{ slug: string }>(
      "SELECT slug FROM restaurants WHERE id=$1",
      [r.restaurant_id],
    );
    const q = await joinQueue(
      {
        name: r.name,
        phone: r.phone,
        partySize: r.party_size,
        slug: restaurant.slug,
        requestId: randomUUID(),
        consent: true,
      },
      r.access_hash,
      tx,
    );
    await tx.query(
      "UPDATE reservations SET status='arrived',queue_entry_id=$2,updated_at=now() WHERE id=$1",
      [id, q.id],
    );
    await tx.query(
      "UPDATE priority_purchases SET queue_entry_id=$2 WHERE reservation_id=$1",
      [id, q.id],
    );
    await tx.query(
      "UPDATE queue_entries SET priority_type=v.priority_type,priority_weight=v.priority_weight FROM reservations v WHERE v.id=$1 AND queue_entries.id=$2",
      [id, q.id],
    );
    await audit(tx, r.restaurant_id, actor, "reservation_arrival", id, {
      queueId: q.id,
    });
    return queueEntry(q.id, tx);
  });
}
