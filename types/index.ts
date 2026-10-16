export type QueueStatus =
  "waiting" | "called" | "seated" | "completed" | "cancelled";
export type OrderStatus =
  "draft" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  timezone: string;
  average_service_minutes: number;
  waiting_count: number;
}
export interface QueueEntry {
  id: string;
  restaurant_id: string;
  customer_id: string;
  queue_number: string;
  priority_type: "standard" | "vip" | "commitment";
  table_number: string | null;
  suggested_table_number?: string | null;
  party_size: number;
  status: QueueStatus;
  joined_at: string;
  called_at: string | null;
  name: string;
  phone: string;
  restaurant_name: string;
  restaurant_slug: string;
  average_service_minutes: number;
  people_ahead: number;
  estimated_minutes: number;
}
export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  available: boolean;
  sold_out: boolean;
  active: boolean;
  vegetarian: boolean;
  item_type: "item" | "combo";
  category: string;
  sort_order: number;
  original_price?: number;
  components?: Array<{ itemId: string; name: string; quantity: number }>;
}
export interface OrderItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}
export interface Order {
  id: string;
  queue_entry_id: string;
  restaurant_id: string;
  customer_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  discount_amount: number;
  discount_reason: string;
  credit_applied: number;
  total: number;
  created_at: string;
  reviewed_at: string | null;
  name: string;
  phone: string;
  queue_number: string;
  items: OrderItem[];
}
export interface Message {
  id: string;
  message_type: string;
  message: string;
  status: string;
  provider: string;
  created_at: string;
  attempts: number;
}
