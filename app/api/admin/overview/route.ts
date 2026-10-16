import { requirePermission } from "@/lib/auth";
import { endpoint } from "@/lib/http";
import { getDb } from "@/lib/db";
import { restaurant } from "@/lib/queue/service";
export const GET = endpoint(async () => {
  await requirePermission("overview:view");
  const r = await restaurant("demo-restaurant"),
    db = await getDb();
  const [metrics] = await db.query(
    `SELECT
 (SELECT count(*)::int FROM queue_entries WHERE restaurant_id=$1 AND status='waiting') AS waiting,
 (SELECT count(*)::int FROM reservations WHERE restaurant_id=$1 AND (starts_at AT TIME ZONE 'Asia/Kolkata')::date=(now() AT TIME ZONE 'Asia/Kolkata')::date AND status NOT IN ('cancelled','expired','no_show')) AS reservations,
 (SELECT count(*)::int FROM restaurant_tables WHERE restaurant_id=$1 AND status='available' AND active) AS available,
 (SELECT count(*)::int FROM restaurant_tables WHERE restaurant_id=$1 AND status IN ('occupied','ordering','preparing','dining','payment_pending')) AS occupied,
 (SELECT count(*)::int FROM orders WHERE restaurant_id=$1 AND payment_status='paid' AND (created_at AT TIME ZONE 'Asia/Kolkata')::date=(now() AT TIME ZONE 'Asia/Kolkata')::date) AS orders,
 (SELECT COALESCE(sum(subtotal-discount_amount),0)::int FROM orders WHERE restaurant_id=$1 AND payment_status='paid' AND (created_at AT TIME ZONE 'Asia/Kolkata')::date=(now() AT TIME ZONE 'Asia/Kolkata')::date) AS sales,
 (SELECT COALESCE(round(avg(extract(epoch FROM (seated_at-joined_at))/60)),0)::int FROM queue_entries WHERE restaurant_id=$1 AND seated_at IS NOT NULL AND service_date=(now() AT TIME ZONE 'Asia/Kolkata')::date) AS wait_minutes`,
    [r.id],
  );
  const upcoming = await db.query(
    "SELECT v.id,c.name,v.starts_at,v.party_size,v.status FROM reservations v JOIN customers c ON c.id=v.customer_id WHERE v.restaurant_id=$1 AND v.starts_at>=now() AND v.status NOT IN ('cancelled','expired','no_show','completed') ORDER BY v.starts_at LIMIT 5",
    [r.id],
  );
  const recent = await db.query(
    "SELECT o.id,c.name,o.total,o.status FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.restaurant_id=$1 ORDER BY o.created_at DESC LIMIT 5",
    [r.id],
  );
  return { metrics, upcoming, recent };
});
