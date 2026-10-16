import { getDb } from "../db";
import { AppError } from "../utils/errors";

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  total_visits: number;
  completed_visits: number;
  cancelled_visits: number;
  no_shows: number;
  total_spend: number;
  average_bill: number;
  last_visit: string | null;
  priority_type: string | null;
  average_feedback: number | null;
}
export async function customerProfiles(
  restaurantId: string,
  search = "",
  customerId?: string,
) {
  return (await getDb()).query<CustomerProfile>(
    `SELECT c.id,c.name,c.phone,
    (SELECT count(*)::int FROM queue_entries q WHERE q.customer_id=c.id AND q.restaurant_id=$1) AS total_visits,
    (SELECT count(*)::int FROM queue_entries q WHERE q.customer_id=c.id AND q.restaurant_id=$1 AND q.status='completed') AS completed_visits,
    (SELECT count(*)::int FROM queue_entries q WHERE q.customer_id=c.id AND q.restaurant_id=$1 AND q.status='cancelled') AS cancelled_visits,
    (SELECT count(*)::int FROM reservations v WHERE v.customer_id=c.id AND v.restaurant_id=$1 AND v.status='no_show') AS no_shows,
    (SELECT COALESCE(sum(o.total),0)::int FROM orders o WHERE o.customer_id=c.id AND o.restaurant_id=$1 AND o.payment_status='paid') AS total_spend,
    (SELECT COALESCE(round(avg(o.total)),0)::int FROM orders o WHERE o.customer_id=c.id AND o.restaurant_id=$1 AND o.payment_status='paid') AS average_bill,
    GREATEST((SELECT max(q.joined_at) FROM queue_entries q WHERE q.customer_id=c.id AND q.restaurant_id=$1),(SELECT max(v.starts_at) FROM reservations v WHERE v.customer_id=c.id AND v.restaurant_id=$1)) AS last_visit,
    (SELECT p.priority_type FROM priority_purchases p WHERE p.customer_id=c.id AND p.restaurant_id=$1 AND p.payment_status='paid' ORDER BY p.created_at DESC LIMIT 1) AS priority_type,
    (SELECT round(avg((f.food_quality_rating+f.service_rating+f.waiting_time_rating+f.cleanliness_rating)/4.0),1)::float FROM feedback f WHERE f.customer_id=c.id AND f.restaurant_id=$1) AS average_feedback
    FROM customers c WHERE ($2='' OR c.name ILIKE '%'||$2||'%' OR c.phone LIKE '%'||$2||'%') AND ($3::uuid IS NULL OR c.id=$3) AND (EXISTS(SELECT 1 FROM queue_entries q WHERE q.customer_id=c.id AND q.restaurant_id=$1) OR EXISTS(SELECT 1 FROM reservations v WHERE v.customer_id=c.id AND v.restaurant_id=$1)) ORDER BY last_visit DESC NULLS LAST,c.name LIMIT 250`,
    [restaurantId, search, customerId || null],
  );
}

export async function customerDetail(restaurantId: string, id: string) {
  const db = await getDb(),
    profile = (await customerProfiles(restaurantId, "", id))[0];
  if (!profile) throw new AppError("Customer not found", 404);
  const [
    visits,
    orders,
    reservations,
    payments,
    feedback,
    discounts,
    favorites,
  ] = await Promise.all([
    db.query(
      "SELECT id,queue_number,party_size,priority_type,status,joined_at,called_at,seated_at,completed_at FROM queue_entries WHERE restaurant_id=$1 AND customer_id=$2 ORDER BY joined_at DESC",
      [restaurantId, id],
    ),
    db.query(
      "SELECT id,status,payment_status,subtotal,discount_amount,credit_applied,total,created_at FROM orders WHERE restaurant_id=$1 AND customer_id=$2 ORDER BY created_at DESC",
      [restaurantId, id],
    ),
    db.query(
      "SELECT id,party_size,starts_at,status,notes FROM reservations WHERE restaurant_id=$1 AND customer_id=$2 ORDER BY starts_at DESC",
      [restaurantId, id],
    ),
    db.query(
      `SELECT p.id,p.amount,p.status,p.method,p.purpose,p.provider,p.created_at FROM payments p LEFT JOIN orders o ON o.id=p.order_id LEFT JOIN priority_purchases pp ON pp.id=p.priority_purchase_id WHERE COALESCE(o.restaurant_id,pp.restaurant_id)=$1 AND COALESCE(o.customer_id,pp.customer_id)=$2 ORDER BY p.created_at DESC`,
      [restaurantId, id],
    ),
    db.query(
      "SELECT id,food_quality_rating,service_rating,waiting_time_rating,cleanliness_rating,comment,created_at FROM feedback WHERE restaurant_id=$1 AND customer_id=$2 ORDER BY created_at DESC",
      [restaurantId, id],
    ),
    db.query(
      "SELECT id,discount_type,percentage,fixed_amount,reason,valid_from,valid_until,used_at,created_at FROM customer_discount_records WHERE restaurant_id=$1 AND customer_id=$2 ORDER BY created_at DESC",
      [restaurantId, id],
    ),
    db.query(
      `SELECT oi.name,sum(oi.quantity)::int AS quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.restaurant_id=$1 AND o.customer_id=$2 AND o.payment_status='paid' GROUP BY oi.name ORDER BY quantity DESC,oi.name LIMIT 10`,
      [restaurantId, id],
    ),
  ]);
  return {
    profile,
    visits,
    orders,
    reservations,
    payments,
    feedback,
    discounts,
    favorites,
  };
}
