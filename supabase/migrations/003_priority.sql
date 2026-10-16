ALTER TABLE queue_entries ADD COLUMN priority_type text NOT NULL DEFAULT 'standard' CHECK(priority_type IN ('standard','vip','commitment'));
ALTER TABLE queue_entries ADD COLUMN priority_weight integer NOT NULL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN priority_type text NOT NULL DEFAULT 'standard' CHECK(priority_type IN ('standard','vip','commitment'));
ALTER TABLE reservations ADD COLUMN priority_weight integer NOT NULL DEFAULT 0;
CREATE TABLE priority_purchases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES restaurants(id), customer_id uuid NOT NULL REFERENCES customers(id),
 queue_entry_id uuid UNIQUE REFERENCES queue_entries(id), reservation_id uuid UNIQUE REFERENCES reservations(id),
 priority_type text NOT NULL CHECK(priority_type IN ('vip','commitment')), amount integer NOT NULL CHECK(amount>0),
 discount_percentage integer NOT NULL CHECK(discount_percentage BETWEEN 0 AND 100), weight integer NOT NULL,
 commitment_policy text NOT NULL CHECK(commitment_policy IN ('retain_minimum','refund_unused')),
 credit_used integer NOT NULL DEFAULT 0 CHECK(credit_used>=0 AND credit_used<=amount),
 payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','failed','paid','refunded')),
 reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(queue_entry_id IS NOT NULL OR reservation_id IS NOT NULL)
);
ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN priority_purchase_id uuid UNIQUE REFERENCES priority_purchases(id);
ALTER TABLE payments ADD COLUMN purpose text NOT NULL DEFAULT 'food_order' CHECK(purpose IN ('food_order','vip_priority','commitment_deposit','remaining_balance','refund'));
ALTER TABLE payments ADD COLUMN method text NOT NULL DEFAULT 'online' CHECK(method IN ('online','cash','credit','card','upi','wallet'));
ALTER TABLE payments ADD CONSTRAINT payments_target_check CHECK((order_id IS NOT NULL)::int+(priority_purchase_id IS NOT NULL)::int=1);
ALTER TABLE payments DROP CONSTRAINT payments_provider_check;
ALTER TABLE payments ADD CONSTRAINT payments_provider_check CHECK(provider IN ('mock','razorpay','credit','cash'));
ALTER TABLE payments DROP CONSTRAINT payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK(amount>=0);
ALTER TABLE orders DROP CONSTRAINT orders_check;
ALTER TABLE orders ADD COLUMN discount_amount integer NOT NULL DEFAULT 0 CHECK(discount_amount>=0);
ALTER TABLE orders ADD COLUMN discount_reason text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN credit_applied integer NOT NULL DEFAULT 0 CHECK(credit_applied>=0);
ALTER TABLE orders ADD COLUMN priority_purchase_id uuid REFERENCES priority_purchases(id);
ALTER TABLE orders ADD CONSTRAINT orders_total_check CHECK(total=subtotal-discount_amount-credit_applied AND total>=0);
ALTER TABLE priority_purchases ENABLE ROW LEVEL SECURITY;
