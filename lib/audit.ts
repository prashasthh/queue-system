import type { Sql } from "./db";
export async function audit(
  tx: Sql,
  restaurantId: string,
  actor: string,
  action: string,
  entityId: string,
  detail: unknown,
) {
  await tx.query(
    "INSERT INTO audit_events(restaurant_id,actor,action,entity_id,detail) VALUES($1,$2,$3,$4,$5::jsonb)",
    [restaurantId, actor, action, entityId, JSON.stringify(detail)],
  );
}
