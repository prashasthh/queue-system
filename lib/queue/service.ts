import { z } from "zod";
import { getDb, type Sql } from "../db";
import type { QueueEntry, QueueStatus, Restaurant } from "@/types";
import { joinSchema } from "../validation";
import { AppError } from "../utils/errors";
import { queueNotification } from "../whatsapp/outbox";
import {
  assignTable,
  autoAllocate,
  eligibleNext,
  lockRestaurant,
} from "../tables/service";
import { enqueueFeedback } from "../feedback/service";
export async function restaurant(slug: string) {
  const [row] = await (
    await getDb()
  ).query<Restaurant>(
    `SELECT r.*, (SELECT count(*)::int FROM queue_entries q WHERE q.restaurant_id=r.id AND q.status='waiting') AS waiting_count FROM restaurants r WHERE slug=$1 AND active=true`,
    [slug],
  );
  if (!row) throw new AppError("Restaurant not found", 404);
  return row;
}
export async function queueEntry(id: string, sql?: Sql) {
  const [row] = await (sql || (await getDb())).query<QueueEntry>(
    `SELECT q.id,q.restaurant_id,q.customer_id,q.priority_type,q.queue_number,q.party_size,q.status,q.joined_at,q.called_at,c.name,c.phone,r.name AS restaurant_name,r.slug AS restaurant_slug,r.average_service_minutes,
  CASE WHEN q.status='waiting' THEN (SELECT count(*)::int FROM queue_entries ahead WHERE ahead.restaurant_id=q.restaurant_id AND ahead.status='waiting' AND (-ahead.priority_weight,ahead.joined_at,ahead.sequence_number)<(-q.priority_weight,q.joined_at,q.sequence_number)) ELSE 0 END AS people_ahead
  FROM queue_entries q JOIN customers c ON c.id=q.customer_id JOIN restaurants r ON r.id=q.restaurant_id WHERE q.id=$1`,
    [id],
  );
  if (!row) throw new AppError("Queue entry not found", 404);
  row.estimated_minutes = row.people_ahead * row.average_service_minutes;
  const [assigned] = await (sql || (await getDb())).query<{
    table_number: string;
  }>(
    "SELECT t.table_number FROM table_assignments a JOIN restaurant_tables t ON t.id=a.table_id WHERE a.queue_entry_id=$1 AND a.released_at IS NULL",
    [id],
  );
  row.table_number = assigned?.table_number || null;
  return row;
}
export async function joinQueue(
  input: z.infer<typeof joinSchema>,
  accessHash: string,
  transaction?: Sql,
) {
  const run = async (tx: Sql) => {
    const [r] = await tx.query<{ id: string; timezone: string }>(
      "SELECT id,timezone FROM restaurants WHERE slug=$1 AND active=true FOR UPDATE",
      [input.slug],
    );
    if (!r) throw new AppError("Restaurant is currently unavailable", 404);
    const [prior] = await tx.query<{ id: string; access_hash: string }>(
      "SELECT id,access_hash FROM queue_entries WHERE request_id=$1",
      [input.requestId],
    );
    if (prior) {
      if (prior.access_hash !== accessHash)
        throw new AppError("This request has already been used", 409);
      return queueEntry(prior.id, tx);
    }
    const [customer] = await tx.query<{ id: string }>(
      "INSERT INTO customers(name,phone) VALUES($1,$2) ON CONFLICT(phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING id",
      [input.name, input.phone],
    );
    const [active] = await tx.query<{ id: string; access_hash: string }>(
      "SELECT id,access_hash FROM queue_entries WHERE restaurant_id=$1 AND customer_id=$2 AND status IN ('waiting','called','seated')",
      [r.id, customer.id],
    );
    if (active) {
      if (active.access_hash === accessHash) return queueEntry(active.id, tx);
      throw new AppError(
        "This phone number already has an active visit. Use the original browser or ask staff for help.",
        409,
      );
    }
    await tx.query("UPDATE customers SET name=$1 WHERE id=$2", [
      input.name,
      customer.id,
    ]);
    const [counter] = await tx.query<{
      last_number: number;
      service_date: string;
    }>(
      `INSERT INTO queue_counters(restaurant_id,service_date,last_number) VALUES($1,(now() AT TIME ZONE $2)::date,1) ON CONFLICT(restaurant_id,service_date) DO UPDATE SET last_number=queue_counters.last_number+1 RETURNING last_number,service_date`,
      [r.id, r.timezone],
    );
    const [entry] = await tx.query<{ id: string }>(
      `INSERT INTO queue_entries(restaurant_id,customer_id,queue_number,sequence_number,service_date,party_size,access_hash,request_id,consent_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) RETURNING id`,
      [
        r.id,
        customer.id,
        `Q${String(counter.last_number).padStart(3, "0")}`,
        counter.last_number,
        counter.service_date,
        input.partySize,
        accessHash,
        input.requestId,
      ],
    );
    const joined = await queueEntry(entry.id, tx);
    await queueNotification(tx, joined);
    return joined;
  };
  return transaction ? run(transaction) : (await getDb()).transaction(run);
}
export const queueTransitions: Record<QueueStatus, QueueStatus[]> = {
  waiting: ["called", "cancelled"],
  called: ["waiting", "seated", "cancelled"],
  seated: ["completed"],
  completed: [],
  cancelled: [],
};
export async function setQueueStatus(id: string, status: QueueStatus, tx: Sql) {
  const [entry] = await tx.query<{ status: QueueStatus }>(
    "SELECT status FROM queue_entries WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!entry) throw new AppError("Queue entry not found", 404);
  if (entry.status === status) return queueEntry(id, tx);
  if (!queueTransitions[entry.status].includes(status))
    throw new AppError(`Cannot change ${entry.status} to ${status}`, 409);
  await tx.query(
    `UPDATE queue_entries SET status=$2, updated_at=now(), called_at=CASE WHEN $2='called' THEN now() WHEN $2='waiting' THEN NULL ELSE called_at END, seated_at=CASE WHEN $2='seated' THEN now() ELSE seated_at END, completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END WHERE id=$1`,
    [id, status],
  );
  if (status === "called") await assignTable(tx, id);
  if (status === "seated")
    await tx.query(
      "UPDATE restaurant_tables SET status='occupied',updated_at=now() WHERE id IN (SELECT table_id FROM table_assignments WHERE queue_entry_id=$1 AND released_at IS NULL)",
      [id],
    );
  if (["completed", "cancelled", "waiting"].includes(status)) {
    await tx.query(
      "UPDATE restaurant_tables SET status=$2,updated_at=now() WHERE id IN (SELECT table_id FROM table_assignments WHERE queue_entry_id=$1 AND released_at IS NULL)",
      [id, status === "completed" ? "cleaning" : "available"],
    );
    await tx.query(
      "UPDATE table_assignments SET released_at=now() WHERE queue_entry_id=$1 AND released_at IS NULL",
      [id],
    );
  }
  if (["seated", "completed", "cancelled"].includes(status))
    await tx.query(
      "UPDATE reservations SET status=$2,updated_at=now() WHERE queue_entry_id=$1",
      [id, status],
    );
  const changed = await queueEntry(id, tx);
  if (status === "called") await queueNotification(tx, changed, true);
  if (status === "completed") await enqueueFeedback(tx, changed);
  if (status === "cancelled") await autoAllocate(tx, changed.restaurant_id);
  return changed;
}
export async function changeQueue(id: string, status: QueueStatus) {
  return (await getDb()).transaction(async (tx) => {
    const q = await queueEntry(id, tx);
    await lockRestaurant(tx, q.restaurant_id);
    return setQueueStatus(id, status, tx);
  });
}
export async function callNext(slug = "demo-restaurant") {
  return (await getDb()).transaction(async (tx) => {
    const [r] = await tx.query<{ id: string }>(
      "SELECT id FROM restaurants WHERE slug=$1 AND active=true FOR UPDATE",
      [slug],
    );
    if (!r) throw new AppError("Restaurant unavailable", 404);
    const [recent] = await tx.query<{ id: string }>(
      "SELECT id FROM queue_entries WHERE restaurant_id=$1 AND called_at > now()-interval '3 seconds' ORDER BY called_at DESC LIMIT 1",
      [r.id],
    );
    if (recent) return queueEntry(recent.id, tx);
    const next = await eligibleNext(tx, r.id);
    if (!next)
      throw new AppError(
        "No waiting party fits an available table. Complete or cancel an active visit, then make its cleaned table available from the Floor page.",
        409,
      );
    return setQueueStatus(next.queueId, "called", tx);
  });
}
export async function adminQueue() {
  return (await getDb())
    .query<QueueEntry>(`SELECT q.id,q.queue_number,q.party_size,q.status,q.joined_at,c.name,c.phone,assigned.table_number,
  CASE WHEN q.status='waiting' THEN (SELECT t.table_number FROM restaurant_tables t JOIN restaurant_settings s ON s.restaurant_id=t.restaurant_id WHERE t.restaurant_id=q.restaurant_id AND t.active AND t.status='available' AND t.capacity>=q.party_size AND NOT EXISTS(SELECT 1 FROM table_assignments ta WHERE ta.table_id=t.id AND ta.released_at IS NULL) AND NOT EXISTS(SELECT 1 FROM reservations v WHERE v.table_id=t.id AND v.status NOT IN ('cancelled','expired','no_show','completed') AND v.starts_at<now()+s.occupancy_minutes*interval '1 minute' AND v.ends_at>now()) ORDER BY t.capacity,t.table_number LIMIT 1) END AS suggested_table_number,
  CASE WHEN q.status='waiting' THEN (SELECT count(*)::int FROM queue_entries a WHERE a.restaurant_id=q.restaurant_id AND a.status='waiting' AND (-a.priority_weight,a.joined_at,a.sequence_number)<(-q.priority_weight,q.joined_at,q.sequence_number)) ELSE 0 END AS people_ahead
  FROM queue_entries q JOIN customers c ON c.id=q.customer_id JOIN restaurants r ON r.id=q.restaurant_id LEFT JOIN LATERAL (SELECT t.table_number FROM table_assignments a JOIN restaurant_tables t ON t.id=a.table_id WHERE a.queue_entry_id=q.id AND a.released_at IS NULL LIMIT 1) assigned ON true WHERE r.slug='demo-restaurant' AND (q.status IN ('waiting','called','seated') OR (q.completed_at AT TIME ZONE r.timezone)::date=(now() AT TIME ZONE r.timezone)::date OR q.service_date=(now() AT TIME ZONE r.timezone)::date) ORDER BY q.joined_at,q.sequence_number`);
}
