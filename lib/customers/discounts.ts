import type { Sql } from "../db";
import { settings } from "../settings/service";

export interface DiscountOffer {
  id: string;
  percentage: number;
  amount: number;
  reason: string;
  type: "returning" | "high_value" | "frequent" | "recovery";
}

export async function discountForOrder(
  tx: Sql,
  restaurantId: string,
  customerId: string,
  subtotal: number,
): Promise<DiscountOffer | null> {
  const config = await settings(restaurantId, tx);
  const [history] = await tx.query<{
    completed_visits: number;
    total_spend: number;
  }>(
    `SELECT (SELECT count(*)::int FROM queue_entries WHERE restaurant_id=$1 AND customer_id=$2 AND status='completed') AS completed_visits,
    (SELECT COALESCE(sum(total),0)::int FROM orders WHERE restaurant_id=$1 AND customer_id=$2 AND payment_status='paid') AS total_spend`,
    [restaurantId, customerId],
  );
  const [latest] = await tx.query<{ average_rating: number }>(
    "SELECT ((food_quality_rating+service_rating+waiting_time_rating+cleanliness_rating)/4.0)::float AS average_rating FROM feedback WHERE restaurant_id=$1 AND customer_id=$2 ORDER BY created_at DESC LIMIT 1",
    [restaurantId, customerId],
  );
  const candidates: Array<{
    type: DiscountOffer["type"];
    percentage: number;
    reason: string;
    details: Record<string, number>;
  }> = [];
  if (
    latest &&
    latest.average_rating <= config.recovery_rating_threshold &&
    config.recovery_discount
  )
    candidates.push({
      type: "recovery",
      percentage: config.recovery_discount,
      reason: "Service recovery offer based on your latest feedback",
      details: { latestRating: latest.average_rating },
    });
  if (
    history.total_spend >= config.high_value_spend_threshold &&
    config.loyalty_discount
  )
    candidates.push({
      type: "high_value",
      percentage: config.loyalty_discount,
      reason: "High-value loyalty offer",
      details: { previousSpend: history.total_spend },
    });
  if (
    history.completed_visits >= config.frequent_visit_threshold &&
    config.loyalty_discount
  )
    candidates.push({
      type: "frequent",
      percentage: config.loyalty_discount,
      reason: "Frequent guest loyalty offer",
      details: { completedVisits: history.completed_visits },
    });
  if (
    history.completed_visits >= config.returning_visit_threshold &&
    config.returning_discount
  )
    candidates.push({
      type: "returning",
      percentage: config.returning_discount,
      reason: "Returning guest offer",
      details: { completedVisits: history.completed_visits },
    });
  candidates.sort((a, b) => b.percentage - a.percentage);
  const best = candidates[0];
  if (!best) return null;
  const [existing] = await tx.query<{
    id: string;
    percentage: number;
    reason: string;
    discount_type: DiscountOffer["type"];
  }>(
    "SELECT id,percentage,reason,discount_type FROM customer_discount_records WHERE restaurant_id=$1 AND customer_id=$2 AND discount_type=$3 AND used_at IS NULL AND valid_from<=now() AND valid_until>now() ORDER BY created_at LIMIT 1 FOR UPDATE",
    [restaurantId, customerId, best.type],
  );
  const record =
    existing ||
    (
      await tx.query<{
        id: string;
        percentage: number;
        reason: string;
        discount_type: DiscountOffer["type"];
      }>(
        "INSERT INTO customer_discount_records(restaurant_id,customer_id,discount_type,percentage,reason,valid_until,source_details) VALUES($1,$2,$3,$4,$5,now()+interval '30 days',$6::jsonb) RETURNING id,percentage,reason,discount_type",
        [
          restaurantId,
          customerId,
          best.type,
          best.percentage,
          best.reason,
          JSON.stringify(best.details),
        ],
      )
    )[0];
  return {
    id: record.id,
    percentage: record.percentage,
    amount: Math.floor((subtotal * record.percentage) / 100),
    reason: record.reason,
    type: record.discount_type,
  };
}
