import { z } from "zod";
import { getDb, type Sql } from "../db";
export const settingsSchema = z
  .object({
    opening_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/),
    closing_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/),
    reservation_capacity: z.number().int().min(1).max(500),
    occupancy_minutes: z.number().int().min(15).max(360),
    reminder_first: z.number().int().min(1).max(1440),
    reminder_second: z.number().int().min(1).max(1440),
    no_show_minutes: z.number().int().min(0).max(120),
    vip_fee: z.number().int().min(0).max(10000000),
    vip_discount: z.number().int().min(0).max(100),
    commitment_minimum: z.number().int().min(1).max(10000000),
    commitment_policy: z.enum(["retain_minimum", "refund_unused"]),
    vip_weight: z.number().int().min(1).max(1000),
    commitment_weight: z.number().int().min(1).max(1000),
    returning_visit_threshold: z.number().int().min(1).max(1000),
    frequent_visit_threshold: z.number().int().min(2).max(1000),
    high_value_spend_threshold: z.number().int().min(1).max(100000000),
    recovery_rating_threshold: z.number().int().min(1).max(4),
    returning_discount: z.number().int().min(0).max(100),
    loyalty_discount: z.number().int().min(0).max(100),
    recovery_discount: z.number().int().min(0).max(100),
  })
  .strict()
  .refine(
    (s) => s.reminder_first > s.reminder_second,
    "First reminder must be earlier than second",
  )
  .refine(
    (s) => s.opening_time !== s.closing_time,
    "Opening and closing times must differ",
  );
export type Settings = z.infer<typeof settingsSchema>;
export async function settings(id: string, tx?: Sql) {
  const db = tx || (await getDb());
  await db.query(
    "INSERT INTO restaurant_settings(restaurant_id) VALUES($1) ON CONFLICT DO NOTHING",
    [id],
  );
  return (
    await db.query<Settings>(
      "SELECT * FROM restaurant_settings WHERE restaurant_id=$1",
      [id],
    )
  )[0];
}
export async function updateSettings(id: string, input: Settings) {
  const value = settingsSchema.parse(input);
  const keys = Object.keys(value) as (keyof Settings)[];
  await (
    await getDb()
  ).query(
    `UPDATE restaurant_settings SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(",")},updated_at=now() WHERE restaurant_id=$1`,
    [id, ...keys.map((k) => value[k])],
  );
  return settings(id);
}
