import { endpoint } from "@/lib/http";
import { requirePermission } from "@/lib/auth";
import { getDb } from "@/lib/db";
export const GET = endpoint(async () => {
  await requirePermission("orders:view");
  return (await getDb()).query(
    `SELECT o.*,c.name,c.phone,q.queue_number,COALESCE((SELECT json_agg(json_build_object('menu_item_id',i.menu_item_id,'name',i.name,'quantity',i.quantity,'unit_price',i.unit_price,'total_price',i.total_price)) FROM order_items i WHERE i.order_id=o.id),'[]') AS items FROM orders o JOIN customers c ON c.id=o.customer_id JOIN queue_entries q ON q.id=o.queue_entry_id JOIN restaurants r ON r.id=o.restaurant_id WHERE r.slug='demo-restaurant' ORDER BY o.created_at DESC LIMIT 100`,
  );
});
