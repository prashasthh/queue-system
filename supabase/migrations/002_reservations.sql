CREATE TABLE restaurant_settings (
 restaurant_id uuid PRIMARY KEY REFERENCES restaurants(id),
 opening_time time NOT NULL DEFAULT '10:00', closing_time time NOT NULL DEFAULT '23:00',
 reservation_capacity integer NOT NULL DEFAULT 60 CHECK(reservation_capacity BETWEEN 1 AND 500),
 occupancy_minutes integer NOT NULL DEFAULT 90 CHECK(occupancy_minutes BETWEEN 15 AND 360),
 reminder_first integer NOT NULL DEFAULT 10 CHECK(reminder_first BETWEEN 1 AND 1440),
 reminder_second integer NOT NULL DEFAULT 5 CHECK(reminder_second BETWEEN 1 AND 1440),
 no_show_minutes integer NOT NULL DEFAULT 10 CHECK(no_show_minutes BETWEEN 0 AND 120),
 vip_fee integer NOT NULL DEFAULT 100000 CHECK(vip_fee>=0),
 vip_discount integer NOT NULL DEFAULT 15 CHECK(vip_discount BETWEEN 0 AND 100),
 commitment_minimum integer NOT NULL DEFAULT 100000 CHECK(commitment_minimum>0),
 commitment_policy text NOT NULL DEFAULT 'retain_minimum' CHECK(commitment_policy IN ('retain_minimum','refund_unused')),
 vip_weight integer NOT NULL DEFAULT 100, commitment_weight integer NOT NULL DEFAULT 50,
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 updated_at timestamptz NOT NULL DEFAULT now(), CHECK(reminder_first>reminder_second), CHECK(opening_time<>closing_time)
);
INSERT INTO restaurant_settings(restaurant_id) SELECT id FROM restaurants;
CREATE TABLE reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 customer_id uuid NOT NULL REFERENCES customers(id), party_size integer NOT NULL CHECK(party_size BETWEEN 1 AND 20),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=500),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','reminder_sent','awaiting_confirmation','arrived','seated','completed','cancelled','expired','no_show')),
 access_hash text NOT NULL, request_id uuid NOT NULL UNIQUE, consent_at timestamptz NOT NULL,
 confirmed_at timestamptz, first_reminder_at timestamptz, second_reminder_at timestamptz,
 queue_entry_id uuid UNIQUE REFERENCES queue_entries(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservation_schedule_idx ON reservations(restaurant_id,starts_at,ends_at,status);
CREATE INDEX reservation_customer_idx ON reservations(customer_id,starts_at);
ALTER TABLE whatsapp_messages ALTER COLUMN queue_entry_id DROP NOT NULL;
ALTER TABLE whatsapp_messages ADD COLUMN reservation_id uuid REFERENCES reservations(id);
ALTER TABLE whatsapp_messages DROP CONSTRAINT whatsapp_messages_message_type_check;
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_message_type_check CHECK(message_type IN ('queue_joined','customer_called','order_confirmed','payment_successful','reservation_created','reservation_confirmation','reservation_reminder_first','reservation_reminder_second','reservation_cancelled','table_ready','feedback_request'));
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
