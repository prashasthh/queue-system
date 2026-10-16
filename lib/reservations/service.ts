import { z } from "zod";
import { getDb, type Sql } from "../db";
import { joinSchema } from "../validation";
import { settings } from "../settings/service";
import { AppError } from "../utils/errors";
import { notifyReservation } from "./notifications";
export const reservationSchema = joinSchema.extend({
  startsAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(500).default(""),
});
export interface Reservation {
  id: string;
  restaurant_id: string;
  customer_id: string;
  name: string;
  phone: string;
  restaurant_name: string;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string;
  access_hash: string;
  confirmed_at: string | null;
  first_reminder_at: string | null;
  second_reminder_at: string | null;
  queue_entry_id: string | null;
  table_id: string | null;
  table_number: string | null;
}
export async function reservation(id: string, tx?: Sql) {
  const [row] = await (tx || (await getDb())).query<Reservation>(
    "SELECT v.*,c.name,c.phone,r.name AS restaurant_name,t.table_number FROM reservations v JOIN customers c ON c.id=v.customer_id JOIN restaurants r ON r.id=v.restaurant_id LEFT JOIN restaurant_tables t ON t.id=v.table_id WHERE v.id=$1",
    [id],
  );
  if (!row) throw new AppError("Reservation not found", 404);
  return row;
}
export function operatingMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (h > 23 || m > 59) throw new AppError("Invalid operating time");
  return h * 60 + m;
}
export function isOpenAt(
  date: Date,
  timezone: string,
  opening: string,
  closing: string,
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const now = operatingMinutes(parts),
    start = operatingMinutes(opening),
    end = operatingMinutes(closing);
  return start < end ? now >= start && now < end : now >= start || now < end;
}
export async function createReservation(
  input: z.infer<typeof reservationSchema>,
  accessHash: string,
  now = new Date(),
) {
  return (await getDb()).transaction(async (tx) => {
    const [r] = await tx.query<{ id: string; timezone: string }>(
      "SELECT id,timezone FROM restaurants WHERE slug=$1 AND active=true FOR UPDATE",
      [input.slug],
    );
    if (!r) throw new AppError("Restaurant unavailable", 404);
    const [prior] = await tx.query<{ id: string; access_hash: string }>(
      "SELECT id,access_hash FROM reservations WHERE request_id=$1",
      [input.requestId],
    );
    if (prior) {
      if (prior.access_hash !== accessHash)
        throw new AppError("Request already used", 409);
      return reservation(prior.id, tx);
    }
    const start = new Date(input.startsAt),
      s = await settings(r.id, tx);
    if (
      start.getTime() <= now.getTime() ||
      start.getTime() > now.getTime() + 90 * 86400000
    )
      throw new AppError("Choose a future time within the next 90 days");
    const end = new Date(start.getTime() + s.occupancy_minutes * 60000);
    if (
      !isOpenAt(start, r.timezone, s.opening_time, s.closing_time) ||
      !isOpenAt(
        new Date(end.getTime() - 1),
        r.timezone,
        s.opening_time,
        s.closing_time,
      )
    )
      throw new AppError(
        "Choose a time with enough dining time before closing",
      );
    const [load] = await tx.query<{ guests: number }>(
      "SELECT COALESCE(sum(party_size),0)::int AS guests FROM reservations WHERE restaurant_id=$1 AND status NOT IN ('cancelled','expired','no_show','completed') AND starts_at<$3 AND ends_at>$2",
      [r.id, start.toISOString(), end.toISOString()],
    );
    if (load.guests + input.partySize > s.reservation_capacity)
      throw new AppError(
        "This time is fully booked. Please choose another time.",
        409,
      );
    const [c] = await tx.query<{ id: string }>(
      "INSERT INTO customers(name,phone) VALUES($1,$2) ON CONFLICT(phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING id",
      [input.name, input.phone],
    );
    const [duplicate] = await tx.query(
      "SELECT id FROM reservations WHERE restaurant_id=$1 AND customer_id=$2 AND status NOT IN ('cancelled','expired','no_show','completed') AND starts_at<$4 AND ends_at>$3",
      [r.id, c.id, start.toISOString(), end.toISOString()],
    );
    if (duplicate)
      throw new AppError(
        "This phone already has a reservation at this time",
        409,
      );
    const [table] = await tx.query<{ id: string }>(
      "SELECT t.id FROM restaurant_tables t WHERE t.restaurant_id=$1 AND t.active AND t.status<>'out_of_service' AND t.capacity>=$2 AND NOT EXISTS(SELECT 1 FROM reservations v WHERE v.table_id=t.id AND v.status NOT IN ('cancelled','expired','no_show','completed') AND v.starts_at<$4 AND v.ends_at>$3) AND NOT EXISTS(SELECT 1 FROM table_assignments a WHERE a.table_id=t.id AND a.released_at IS NULL AND a.assigned_at+$5*interval '1 minute'>$3) ORDER BY t.capacity,t.table_number LIMIT 1 FOR UPDATE",
      [
        r.id,
        input.partySize,
        start.toISOString(),
        end.toISOString(),
        s.occupancy_minutes,
      ],
    );
    if (!table)
      throw new AppError("No suitable table is available at that time", 409);
    const [created] = await tx.query<{ id: string }>(
      "INSERT INTO reservations(restaurant_id,customer_id,party_size,starts_at,ends_at,notes,access_hash,request_id,consent_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) RETURNING id",
      [
        r.id,
        c.id,
        input.partySize,
        start.toISOString(),
        end.toISOString(),
        input.notes,
        accessHash,
        input.requestId,
      ],
    );
    await tx.query("UPDATE reservations SET table_id=$2 WHERE id=$1", [
      created.id,
      table.id,
    ]);
    const result = await reservation(created.id, tx);
    await notifyReservation(
      tx,
      result,
      "reservation_created",
      "Your reservation is booked. We’ll ask you to confirm before arrival.",
    );
    return result;
  });
}
export async function reservations(restaurantId: string) {
  return (await getDb()).query<Reservation>(
    "SELECT v.*,c.name,c.phone,t.table_number FROM reservations v JOIN customers c ON c.id=v.customer_id LEFT JOIN restaurant_tables t ON t.id=v.table_id WHERE v.restaurant_id=$1 ORDER BY v.starts_at DESC LIMIT 200",
    [restaurantId],
  );
}
