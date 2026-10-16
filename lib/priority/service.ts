import { getDb, type Sql } from "../db";
import { settings } from "../settings/service";
import { AppError } from "../utils/errors";
export type PriorityType = "standard" | "vip" | "commitment";
export type VisitKind = "queue" | "reservation";
export interface PriorityPurchase {
  id: string;
  restaurant_id: string;
  customer_id: string;
  queue_entry_id: string | null;
  reservation_id: string | null;
  priority_type: "vip" | "commitment";
  amount: number;
  discount_percentage: number;
  weight: number;
  commitment_policy: string;
  credit_used: number;
  payment_status: string;
  reviewed_at: string | null;
  name: string;
  phone: string;
  restaurant_name: string;
}
export interface PriorityOffer {
  status: string;
  restaurantSlug: string;
  eligible: boolean;
  paidPriority: "vip" | "commitment" | null;
  options: Awaited<ReturnType<typeof priorityOptions>>;
}
export async function purchase(id: string, tx?: Sql) {
  const [p] = await (tx || (await getDb())).query<PriorityPurchase>(
    "SELECT p.*,c.name,c.phone,r.name AS restaurant_name FROM priority_purchases p JOIN customers c ON c.id=p.customer_id JOIN restaurants r ON r.id=p.restaurant_id WHERE p.id=$1",
    [id],
  );
  if (!p) throw new AppError("Priority purchase not found", 404);
  return p;
}
export async function priorityOptions(kind: VisitKind, id: string, tx?: Sql) {
  const db = tx || (await getDb());
  const table = kind === "queue" ? "queue_entries" : "reservations";
  const [v] = await db.query<{ restaurant_id: string }>(
    `SELECT restaurant_id FROM ${table} WHERE id=$1`,
    [id],
  );
  if (!v) throw new AppError("Visit not found", 404);
  const s = await settings(v.restaurant_id, db);
  return [
    {
      type: "vip" as const,
      amount: s.vip_fee,
      discount: s.vip_discount,
      weight: s.vip_weight,
      policy: s.commitment_policy,
    },
    {
      type: "commitment" as const,
      amount: s.commitment_minimum,
      discount: 0,
      weight: s.commitment_weight,
      policy: s.commitment_policy,
    },
  ];
}
export async function priorityOffer(
  kind: VisitKind,
  id: string,
): Promise<PriorityOffer> {
  const db = await getDb();
  const table = kind === "queue" ? "queue_entries" : "reservations";
  const column = kind === "queue" ? "queue_entry_id" : "reservation_id";
  const [visit] = await db.query<{
    status: string;
    restaurant_slug: string;
  }>(
    `SELECT v.status,r.slug AS restaurant_slug FROM ${table} v JOIN restaurants r ON r.id=v.restaurant_id WHERE v.id=$1`,
    [id],
  );
  if (!visit) throw new AppError("Visit not found", 404);
  const [paid] = await db.query<{ priority_type: "vip" | "commitment" }>(
    `SELECT priority_type FROM priority_purchases WHERE ${column}=$1 AND payment_status='paid'`,
    [id],
  );
  const eligible =
    kind === "queue"
      ? visit.status === "waiting"
      : [
          "pending",
          "confirmed",
          "reminder_sent",
          "awaiting_confirmation",
        ].includes(visit.status);
  return {
    status: visit.status,
    restaurantSlug: visit.restaurant_slug,
    eligible,
    paidPriority: paid?.priority_type || null,
    options: await priorityOptions(kind, id, db),
  };
}
export async function createPriority(
  kind: VisitKind,
  id: string,
  type: "vip" | "commitment",
) {
  return (await getDb()).transaction(async (tx) => {
    const table = kind === "queue" ? "queue_entries" : "reservations",
      column = kind === "queue" ? "queue_entry_id" : "reservation_id";
    const [v] = await tx.query<{
      restaurant_id: string;
      customer_id: string;
      status: string;
    }>(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
    if (
      !v ||
      ![
        "waiting",
        "pending",
        "confirmed",
        "reminder_sent",
        "awaiting_confirmation",
      ].includes(v.status)
    )
      throw new AppError(
        kind === "queue"
          ? "Fast-track is only available while you are waiting"
          : "Priority is only available before your reservation is seated",
        409,
      );
    const [existing] = await tx.query<{ id: string }>(
      `SELECT id FROM priority_purchases WHERE ${column}=$1`,
      [id],
    );
    const option = (await priorityOptions(kind, id, tx)).find(
      (o) => o.type === type,
    )!;
    if (option.amount <= 0)
      throw new AppError("This priority option is disabled", 409);
    if (existing) {
      const prior = await purchase(existing.id, tx);
      if (prior.priority_type === type) return prior;
      const [payment] = await tx.query(
        "SELECT id FROM payments WHERE priority_purchase_id=$1",
        [prior.id],
      );
      if (payment || prior.payment_status === "paid")
        throw new AppError(
          "Payment has already started. Finish it before changing priority.",
          409,
        );
      await tx.query(
        "UPDATE priority_purchases SET priority_type=$2,amount=$3,discount_percentage=$4,weight=$5,commitment_policy=$6,reviewed_at=NULL WHERE id=$1",
        [
          prior.id,
          type,
          option.amount,
          option.discount,
          option.weight,
          option.policy,
        ],
      );
      return purchase(prior.id, tx);
    }
    const [p] = await tx.query<{ id: string }>(
      `INSERT INTO priority_purchases(restaurant_id,customer_id,${column},priority_type,amount,discount_percentage,weight,commitment_policy) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        v.restaurant_id,
        v.customer_id,
        id,
        type,
        option.amount,
        option.discount,
        option.weight,
        option.policy,
      ],
    );
    return purchase(p.id, tx);
  });
}
export async function reviewPriority(id: string) {
  await (
    await getDb()
  ).query(
    "UPDATE priority_purchases SET reviewed_at=now() WHERE id=$1 AND payment_status<>'paid'",
    [id],
  );
  return purchase(id);
}
export async function priceBenefits(
  tx: Sql,
  queueId: string,
  subtotal: number,
) {
  const [p] = await tx.query<PriorityPurchase>(
    "SELECT * FROM priority_purchases WHERE queue_entry_id=$1 AND payment_status='paid' FOR UPDATE",
    [queueId],
  );
  if (!p) return { discount: 0, reason: "", credit: 0, purchaseId: null };
  const discount =
    p.priority_type === "vip"
      ? Math.floor((subtotal * p.discount_percentage) / 100)
      : 0;
  const credit =
    p.priority_type === "commitment"
      ? Math.min(subtotal - discount, p.amount - p.credit_used)
      : 0;
  if (credit) {
    const [draft] = await tx.query(
      "SELECT id FROM orders WHERE queue_entry_id=$1 AND status='draft' AND credit_applied>0",
      [queueId],
    );
    if (draft)
      throw new AppError(
        "Finish or edit your existing reviewed order before using more commitment credit",
        409,
      );
    await tx.query(
      "UPDATE priority_purchases SET credit_used=credit_used+$2 WHERE id=$1",
      [p.id, credit],
    );
  }
  return {
    discount,
    reason: discount ? `VIP ${p.discount_percentage}%` : "",
    credit,
    purchaseId: p.id,
  };
}
