import { getDb, type Sql } from "../db";
import { AppError } from "../utils/errors";
import { tableTransitions, type TableStatus } from "./states";
import { audit } from "../audit";
import { setQueueStatus } from "../queue/service";
export interface Table {
  id: string;
  restaurant_id: string;
  table_number: string;
  name: string;
  capacity: number;
  status: TableStatus;
  floor_section: string;
  active: boolean;
  customer_name: string | null;
  party_size: number | null;
  queue_entry_id: string | null;
  assigned_at: string | null;
  order_status: string | null;
  reservation_id: string | null;
  queue_status: string | null;
}
export async function lockRestaurant(tx: Sql, id: string) {
  await tx.query("SELECT id FROM restaurants WHERE id=$1 FOR UPDATE", [id]);
}
export async function suitableTables(
  tx: Sql,
  restaurantId: string,
  partySize: number,
  queueId?: string,
) {
  return tx.query<Table>(
    `SELECT t.* FROM restaurant_tables t JOIN restaurant_settings s ON s.restaurant_id=t.restaurant_id WHERE t.restaurant_id=$1 AND t.capacity>=$2 AND t.active AND t.status='available' AND NOT EXISTS(SELECT 1 FROM table_assignments a WHERE a.table_id=t.id AND a.released_at IS NULL) AND NOT EXISTS(SELECT 1 FROM reservations r WHERE r.table_id=t.id AND r.status NOT IN ('cancelled','expired','no_show','completed') AND (r.queue_entry_id IS NULL OR r.queue_entry_id<>$3::uuid) AND r.starts_at<now()+s.occupancy_minutes*interval '1 minute' AND r.ends_at>now()) ORDER BY t.capacity,t.table_number FOR UPDATE OF t`,
    [restaurantId, partySize, queueId || null],
  );
}
export async function assignTable(
  tx: Sql,
  queueId: string,
  preferred?: string,
) {
  const [q] = await tx.query<{ restaurant_id: string; party_size: number }>(
    "SELECT restaurant_id,party_size FROM queue_entries WHERE id=$1",
    [queueId],
  );
  if (!q) throw new AppError("Visit unavailable", 404);
  const [existing] = await tx.query<{ table_id: string }>(
    "SELECT table_id FROM table_assignments WHERE queue_entry_id=$1 AND released_at IS NULL",
    [queueId],
  );
  if (existing) return existing.table_id;
  const tables = await suitableTables(
    tx,
    q.restaurant_id,
    q.party_size,
    queueId,
  );
  const table = preferred ? tables.find((t) => t.id === preferred) : tables[0];
  if (!table)
    throw new AppError("No suitable table is available for this party", 409);
  await tx.query(
    "INSERT INTO table_assignments(table_id,queue_entry_id,reservation_id) VALUES($1,$2,(SELECT id FROM reservations WHERE queue_entry_id=$2))",
    [table.id, queueId],
  );
  await tx.query(
    "UPDATE restaurant_tables SET status='waiting_for_guests',updated_at=now() WHERE id=$1",
    [table.id],
  );
  return table.id;
}
export async function eligibleNext(tx: Sql, restaurantId: string) {
  const waiting = await tx.query<{ id: string; party_size: number }>(
    "SELECT id,party_size FROM queue_entries WHERE restaurant_id=$1 AND status='waiting' ORDER BY priority_weight DESC,joined_at,sequence_number",
    [restaurantId],
  );
  for (const q of waiting) {
    const [table] = await suitableTables(tx, restaurantId, q.party_size, q.id);
    if (table) return { queueId: q.id, table };
  }
  return null;
}
export async function autoAllocate(tx: Sql, restaurantId: string) {
  await lockRestaurant(tx, restaurantId);
  const next = await eligibleNext(tx, restaurantId);
  if (next) return setQueueStatus(next.queueId, "called", tx);
  return null;
}
export async function floor(restaurantId: string) {
  return (await getDb()).query<Table>(
    `SELECT t.*,c.name AS customer_name,q.party_size,q.id AS queue_entry_id,q.status AS queue_status,a.assigned_at,a.reservation_id,(SELECT o.status FROM orders o WHERE o.queue_entry_id=q.id ORDER BY o.created_at DESC LIMIT 1) AS order_status FROM restaurant_tables t LEFT JOIN table_assignments a ON a.table_id=t.id AND a.released_at IS NULL LEFT JOIN queue_entries q ON q.id=a.queue_entry_id LEFT JOIN customers c ON c.id=q.customer_id WHERE t.restaurant_id=$1 ORDER BY t.floor_section,t.table_number`,
    [restaurantId],
  );
}
export async function changeTable(
  id: string,
  status: TableStatus,
  actor: string,
  overrideReason?: string,
) {
  return (await getDb()).transaction(async (tx) => {
    const [t] = await tx.query<Table>(
      "SELECT * FROM restaurant_tables WHERE id=$1",
      [id],
    );
    if (!t) throw new AppError("Table not found", 404);
    await lockRestaurant(tx, t.restaurant_id);
    const [current] = await tx.query<Table>(
      "SELECT * FROM restaurant_tables WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (current.status === status) return current;
    if (!overrideReason && !tableTransitions[current.status].includes(status))
      throw new AppError(`Cannot change ${current.status} to ${status}`, 409);
    const [assignment] = await tx.query<{ queue_entry_id: string }>(
      "SELECT queue_entry_id FROM table_assignments WHERE table_id=$1 AND released_at IS NULL",
      [id],
    );
    if (
      assignment &&
      ["available", "cleaning", "out_of_service"].includes(status)
    )
      throw new AppError(
        "Complete or cancel the assigned visit before releasing this table",
        409,
      );
    if (status === "occupied" && assignment)
      await setQueueStatus(assignment.queue_entry_id, "seated", tx);
    await tx.query(
      "UPDATE restaurant_tables SET status=$2,updated_at=now() WHERE id=$1",
      [id, status],
    );
    await audit(
      tx,
      t.restaurant_id,
      actor,
      overrideReason ? "table_override" : "table_transition",
      id,
      { from: current.status, to: status, reason: overrideReason },
    );
    if (status === "available") await autoAllocate(tx, t.restaurant_id);
    return { ok: true };
  });
}
export async function manualAssign(
  queueId: string,
  tableId: string,
  actor: string,
) {
  return (await getDb()).transaction(async (tx) => {
    const [q] = await tx.query<{ restaurant_id: string; status: string }>(
      "SELECT restaurant_id,status FROM queue_entries WHERE id=$1",
      [queueId],
    );
    if (!q || q.status !== "waiting")
      throw new AppError("Choose a waiting visit", 409);
    await lockRestaurant(tx, q.restaurant_id);
    const [current] = await tx.query<{ status: string }>(
      "SELECT status FROM queue_entries WHERE id=$1 FOR UPDATE",
      [queueId],
    );
    if (current.status !== "waiting")
      throw new AppError("Choose a waiting visit", 409);
    await assignTable(tx, queueId, tableId);
    await audit(tx, q.restaurant_id, actor, "table_assignment", tableId, {
      queueId,
    });
    return setQueueStatus(queueId, "called", tx);
  });
}
