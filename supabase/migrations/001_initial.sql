CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE restaurants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE,
 whatsapp_number text, address text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 average_service_minutes integer NOT NULL DEFAULT 5 CHECK (average_service_minutes BETWEEN 1 AND 120),
 timezone text NOT NULL DEFAULT 'Asia/Kolkata', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
 phone text NOT NULL UNIQUE CHECK (phone ~ '^\+91[6-9][0-9]{9}$'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE queue_counters (
 restaurant_id uuid NOT NULL REFERENCES restaurants(id), service_date date NOT NULL,
 last_number integer NOT NULL CHECK (last_number > 0), PRIMARY KEY (restaurant_id, service_date)
);
CREATE TABLE queue_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 customer_id uuid NOT NULL REFERENCES customers(id), queue_number text NOT NULL, sequence_number integer NOT NULL,
 service_date date NOT NULL, party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 20),
 status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','called','seated','completed','cancelled')),
 access_hash text NOT NULL, request_id uuid NOT NULL UNIQUE, consent_at timestamptz NOT NULL,
 joined_at timestamptz NOT NULL DEFAULT now(), called_at timestamptz, seated_at timestamptz, completed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (restaurant_id,service_date,queue_number), UNIQUE (id,restaurant_id,customer_id)
);
CREATE UNIQUE INDEX queue_one_active_visit ON queue_entries (restaurant_id,customer_id) WHERE status IN ('waiting','called','seated');
CREATE INDEX queue_fifo ON queue_entries (restaurant_id,status,joined_at,sequence_number);
CREATE TABLE menu_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 name text NOT NULL, sort_order integer NOT NULL DEFAULT 0, UNIQUE (restaurant_id,name), UNIQUE(id,restaurant_id)
);
CREATE TABLE menu_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES restaurants(id), category_id uuid NOT NULL,
 name text NOT NULL, description text NOT NULL DEFAULT '', price integer NOT NULL CHECK (price > 0),
 image_url text, available boolean NOT NULL DEFAULT true, vegetarian boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (category_id,restaurant_id) REFERENCES menu_categories(id,restaurant_id), UNIQUE(restaurant_id,name), UNIQUE(id,restaurant_id)
);
CREATE INDEX menu_category_idx ON menu_items(category_id);
CREATE TABLE orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 customer_id uuid NOT NULL REFERENCES customers(id), queue_entry_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','preparing','ready','completed','cancelled')),
 payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','failed','refunded')),
 subtotal integer NOT NULL CHECK(subtotal > 0), total integer NOT NULL CHECK(total = subtotal),
 request_id uuid NOT NULL UNIQUE, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(queue_entry_id,restaurant_id,customer_id) REFERENCES queue_entries(id,restaurant_id,customer_id)
);
CREATE INDEX orders_queue_idx ON orders(queue_entry_id,created_at);
CREATE INDEX orders_restaurant_idx ON orders(restaurant_id,created_at DESC);
CREATE TABLE order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id),
 menu_item_id uuid NOT NULL REFERENCES menu_items(id), name text NOT NULL,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 20), unit_price integer NOT NULL CHECK(unit_price > 0),
 total_price integer NOT NULL CHECK(total_price = quantity * unit_price), UNIQUE(order_id,menu_item_id)
);
CREATE TABLE payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
 provider text NOT NULL CHECK(provider IN ('mock','razorpay')), provider_payment_id text UNIQUE, provider_order_id text UNIQUE,
 amount integer NOT NULL CHECK(amount > 0), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE whatsapp_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES customers(id),
 queue_entry_id uuid NOT NULL REFERENCES queue_entries(id), order_id uuid REFERENCES orders(id),
 phone text NOT NULL, message_type text NOT NULL CHECK(message_type IN ('queue_joined','customer_called','order_confirmed','payment_successful')),
 message text NOT NULL, template_parameters jsonb NOT NULL DEFAULT '[]', event_key text NOT NULL UNIQUE,
 provider text NOT NULL DEFAULT 'mock', provider_message_id text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0, last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_outbox_idx ON whatsapp_messages(status,created_at);
CREATE INDEX whatsapp_visit_idx ON whatsapp_messages(queue_entry_id,created_at);
CREATE TABLE rate_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);

-- Supabase browser roles cannot access any table. The app uses its server database role.
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
INSERT INTO schema_migrations(version) VALUES ('001_initial');
