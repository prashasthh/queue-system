import { getDb } from "../db";
import { reservation } from "./service";
import { notifyReservation } from "./notifications";
import { AppError } from "../utils/errors";
import { autoAllocate, lockRestaurant } from "../tables/service";
export async function confirmReservation(
  id: string,
  answer: "yes" | "no",
  now = new Date(),
) {
  return (await getDb()).transaction(async (tx) => {
    await lockRestaurant(tx, (await reservation(id, tx)).restaurant_id);
    await tx.query("SELECT id FROM reservations WHERE id=$1 FOR UPDATE", [id]);
    const r = await reservation(id, tx);
    if (
      [
        "cancelled",
        "expired",
        "no_show",
        "completed",
        "arrived",
        "seated",
      ].includes(r.status)
    )
      throw new AppError("This reservation can no longer be changed", 409);
    const [s] = await tx.query<{ no_show_minutes: number }>(
      "SELECT no_show_minutes FROM restaurant_settings WHERE restaurant_id=$1",
      [r.restaurant_id],
    );
    if (
      now.getTime() >=
      new Date(r.starts_at).getTime() + s.no_show_minutes * 60000
    )
      throw new AppError("The confirmation deadline has passed", 409);
    await tx.query(
      "UPDATE reservations SET status=$2,confirmed_at=CASE WHEN $2='confirmed' THEN $3::timestamptz ELSE confirmed_at END,updated_at=now() WHERE id=$1",
      [id, answer === "yes" ? "confirmed" : "cancelled", now.toISOString()],
    );
    await notifyReservation(
      tx,
      r,
      answer === "yes" ? "reservation_confirmation" : "reservation_cancelled",
      answer === "yes"
        ? "Thank you for confirming. We look forward to seeing you."
        : "Your reservation has been cancelled.",
    );
    if (answer === "no") await autoAllocate(tx, r.restaurant_id);
    return { ok: true };
  });
}
export async function processReservations(now = new Date()) {
  return (await getDb()).transaction(async (tx) => {
    // Global stable ordering keeps worker locks compatible with restaurant operations.
    await tx.query("SELECT id FROM restaurants ORDER BY id FOR UPDATE");
    const rows = await tx.query<{
      id: string;
      starts_at: string;
      confirmed_at: string | null;
      first_reminder_at: string | null;
      second_reminder_at: string | null;
      reminder_first: number;
      reminder_second: number;
      no_show_minutes: number;
    }>(
      "SELECT v.*,s.reminder_first,s.reminder_second,s.no_show_minutes FROM reservations v JOIN restaurant_settings s ON s.restaurant_id=v.restaurant_id WHERE v.status IN ('pending','confirmed','reminder_sent','awaiting_confirmation') AND v.starts_at- s.reminder_first * interval '1 minute'<=$1 FOR UPDATE OF v SKIP LOCKED",
      [now.toISOString()],
    );
    let expired = 0,
      reminders = 0;
    for (const row of rows) {
      const start = new Date(row.starts_at).getTime(),
        r = await reservation(row.id, tx);
      if (now.getTime() >= start + row.no_show_minutes * 60000) {
        await tx.query(
          "UPDATE reservations SET status=$2,updated_at=now() WHERE id=$1",
          [row.id, row.confirmed_at ? "no_show" : "expired"],
        );
        await notifyReservation(
          tx,
          r,
          "reservation_cancelled",
          row.confirmed_at
            ? "Your arrival window has passed. Please contact the restaurant to rebook."
            : "Your reservation expired because we did not receive confirmation.",
        );
        expired++;
        await autoAllocate(tx, r.restaurant_id);
        continue;
      }
      if (row.confirmed_at) continue;
      if (!row.first_reminder_at) {
        await notifyReservation(
          tx,
          r,
          "reservation_reminder_first",
          "Your reservation is approaching. Are you still coming? Choose YES or NO using the link below.",
        );
        await tx.query(
          "UPDATE reservations SET first_reminder_at=$2,status='reminder_sent',updated_at=now() WHERE id=$1",
          [row.id, now.toISOString()],
        );
        reminders++;
      }
      if (
        !row.second_reminder_at &&
        now.getTime() >= start - row.reminder_second * 60000
      ) {
        await notifyReservation(
          tx,
          r,
          "reservation_reminder_second",
          "Please confirm YES or NO. Your reservation will expire if you don’t respond before the arrival deadline.",
        );
        await tx.query(
          "UPDATE reservations SET second_reminder_at=$2,status='awaiting_confirmation',updated_at=now() WHERE id=$1",
          [row.id, now.toISOString()],
        );
        reminders++;
      }
    }
    return { reminders, expired };
  });
}
