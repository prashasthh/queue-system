import { z } from "zod";
import { getDb, type Sql } from "../db";
import type { QueueEntry } from "@/types";
import { AppError } from "../utils/errors";
import { appUrl, enqueue } from "../whatsapp/outbox";
import { visitTicket } from "../visit-token";

export const feedbackInput = z
  .object({
    foodQualityRating: z.number().int().min(1).max(5),
    serviceRating: z.number().int().min(1).max(5),
    waitingTimeRating: z.number().int().min(1).max(5),
    cleanlinessRating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000),
  })
  .strict();

export async function enqueueFeedback(tx: Sql, queue: QueueEntry) {
  const url = `${appUrl()}/feedback/${queue.id}?token=${visitTicket(queue.id)}`;
  await enqueue(
    tx,
    queue,
    "feedback_request",
    `Thank you for visiting ${queue.restaurant_name}. How was your experience? Share your feedback here: ${url}`,
    [queue.restaurant_name, url],
    `feedback:${queue.id}`,
  );
}

export async function feedbackVisit(id: string, sql?: Sql) {
  const [row] = await (sql || (await getDb())).query<{
    id: string;
    status: string;
    queue_number: string;
    restaurant_name: string;
    customer_name: string;
    feedback_id: string | null;
  }>(
    `SELECT q.id,q.status,q.queue_number,r.name AS restaurant_name,c.name AS customer_name,f.id AS feedback_id FROM queue_entries q JOIN restaurants r ON r.id=q.restaurant_id JOIN customers c ON c.id=q.customer_id LEFT JOIN feedback f ON f.queue_entry_id=q.id WHERE q.id=$1`,
    [id],
  );
  if (!row) throw new AppError("Visit not found", 404);
  return row;
}

export async function submitFeedback(id: string, raw: unknown) {
  const value = feedbackInput.parse(raw);
  return (await getDb()).transaction(async (tx) => {
    const [visit] = await tx.query<{
      restaurant_id: string;
      customer_id: string;
      status: string;
    }>(
      "SELECT restaurant_id,customer_id,status FROM queue_entries WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!visit) throw new AppError("Visit not found", 404);
    if (visit.status !== "completed")
      throw new AppError("Feedback opens after the visit is completed", 409);
    const [existing] = await tx.query<{ id: string }>(
      "SELECT id FROM feedback WHERE queue_entry_id=$1",
      [id],
    );
    if (existing) return { id: existing.id, duplicate: true };
    const [created] = await tx.query<{ id: string }>(
      `INSERT INTO feedback(restaurant_id,customer_id,queue_entry_id,order_id,reservation_id,food_quality_rating,service_rating,waiting_time_rating,cleanliness_rating,comment)
      VALUES($1,$2,$3,(SELECT id FROM orders WHERE queue_entry_id=$3 AND payment_status='paid' ORDER BY created_at DESC LIMIT 1),(SELECT id FROM reservations WHERE queue_entry_id=$3),$4,$5,$6,$7,$8) RETURNING id`,
      [
        visit.restaurant_id,
        visit.customer_id,
        id,
        value.foodQualityRating,
        value.serviceRating,
        value.waitingTimeRating,
        value.cleanlinessRating,
        value.comment,
      ],
    );
    return { id: created.id, duplicate: false };
  });
}

export async function feedbackDashboard(restaurantId: string) {
  const db = await getDb();
  const [averages] = await db.query<{
    food: number | null;
    service: number | null;
    waiting: number | null;
    cleanliness: number | null;
    responses: number;
  }>(
    `SELECT round(avg(food_quality_rating),1)::float AS food,round(avg(service_rating),1)::float AS service,round(avg(waiting_time_rating),1)::float AS waiting,round(avg(cleanliness_rating),1)::float AS cleanliness,count(*)::int AS responses FROM feedback WHERE restaurant_id=$1`,
    [restaurantId],
  );
  const recent = await db.query<{
    id: string;
    name: string;
    queue_number: string;
    comment: string;
    average: number;
    created_at: string;
  }>(
    `SELECT f.id,c.name,q.queue_number,f.comment,((f.food_quality_rating+f.service_rating+f.waiting_time_rating+f.cleanliness_rating)/4.0)::float AS average,f.created_at FROM feedback f JOIN customers c ON c.id=f.customer_id JOIN queue_entries q ON q.id=f.queue_entry_id WHERE f.restaurant_id=$1 ORDER BY f.created_at DESC LIMIT 50`,
    [restaurantId],
  );
  return { averages, recent };
}
