ALTER TABLE restaurant_settings ADD COLUMN returning_visit_threshold integer NOT NULL DEFAULT 1 CHECK(returning_visit_threshold BETWEEN 1 AND 1000);
ALTER TABLE restaurant_settings ADD COLUMN frequent_visit_threshold integer NOT NULL DEFAULT 5 CHECK(frequent_visit_threshold BETWEEN 2 AND 1000);
ALTER TABLE restaurant_settings ADD COLUMN high_value_spend_threshold integer NOT NULL DEFAULT 500000 CHECK(high_value_spend_threshold BETWEEN 1 AND 100000000);
ALTER TABLE restaurant_settings ADD COLUMN recovery_rating_threshold integer NOT NULL DEFAULT 2 CHECK(recovery_rating_threshold BETWEEN 1 AND 4);
ALTER TABLE restaurant_settings ADD COLUMN returning_discount integer NOT NULL DEFAULT 5 CHECK(returning_discount BETWEEN 0 AND 100);
ALTER TABLE restaurant_settings ADD COLUMN loyalty_discount integer NOT NULL DEFAULT 10 CHECK(loyalty_discount BETWEEN 0 AND 100);
ALTER TABLE restaurant_settings ADD COLUMN recovery_discount integer NOT NULL DEFAULT 10 CHECK(recovery_discount BETWEEN 0 AND 100);
CREATE TABLE feedback (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES restaurants(id),customer_id uuid NOT NULL REFERENCES customers(id),
 queue_entry_id uuid NOT NULL UNIQUE REFERENCES queue_entries(id),order_id uuid REFERENCES orders(id),reservation_id uuid REFERENCES reservations(id),
 food_quality_rating integer NOT NULL CHECK(food_quality_rating BETWEEN 1 AND 5),service_rating integer NOT NULL CHECK(service_rating BETWEEN 1 AND 5),
 waiting_time_rating integer NOT NULL CHECK(waiting_time_rating BETWEEN 1 AND 5),cleanliness_rating integer NOT NULL CHECK(cleanliness_rating BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '' CHECK(length(comment)<=1000),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_restaurant_idx ON feedback(restaurant_id,created_at DESC);
CREATE INDEX feedback_customer_idx ON feedback(customer_id,created_at DESC);
CREATE TABLE customer_discount_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES restaurants(id),customer_id uuid NOT NULL REFERENCES customers(id),
 discount_type text NOT NULL CHECK(discount_type IN ('returning','high_value','frequent','recovery')),percentage integer CHECK(percentage BETWEEN 1 AND 100),fixed_amount integer CHECK(fixed_amount>0),
 reason text NOT NULL,valid_from timestamptz NOT NULL DEFAULT now(),valid_until timestamptz NOT NULL,used_at timestamptz,order_id uuid UNIQUE REFERENCES orders(id),
 source_details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),CHECK((percentage IS NOT NULL)::int+(fixed_amount IS NOT NULL)::int=1),CHECK(valid_until>valid_from)
);
CREATE INDEX customer_discount_available_idx ON customer_discount_records(restaurant_id,customer_id,valid_until) WHERE used_at IS NULL;
ALTER TABLE orders ADD COLUMN discount_record_id uuid REFERENCES customer_discount_records(id);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_discount_records ENABLE ROW LEVEL SECURITY;
