ALTER TABLE payments ADD COLUMN recorded_by uuid REFERENCES staff_users(id);
ALTER TABLE payments ADD COLUMN paid_at timestamptz;
UPDATE payments SET paid_at=updated_at WHERE status='paid';
CREATE TABLE refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES restaurants(id),payment_id uuid NOT NULL REFERENCES payments(id),
 order_id uuid REFERENCES orders(id),priority_purchase_id uuid REFERENCES priority_purchases(id),amount integer NOT NULL CHECK(amount>0),
 reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 500),staff_user_id uuid REFERENCES staff_users(id),provider_refund_id text,
 status text NOT NULL DEFAULT 'completed' CHECK(status IN ('pending','completed','failed')),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(order_id IS NOT NULL OR priority_purchase_id IS NOT NULL)
);
CREATE INDEX refunds_payment_idx ON refunds(payment_id,created_at DESC);
CREATE INDEX refunds_restaurant_idx ON refunds(restaurant_id,created_at DESC);
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
