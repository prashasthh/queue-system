CREATE TABLE restaurant_tables (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES restaurants(id),table_number text NOT NULL,name text NOT NULL,capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 20),
 status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','waiting_for_guests','occupied','ordering','preparing','dining','payment_pending','cleaning','out_of_service')),
 floor_section text NOT NULL DEFAULT 'Main',active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(restaurant_id,table_number)
);
INSERT INTO restaurant_tables(restaurant_id,table_number,name,capacity) SELECT r.id,v.number,v.name,v.capacity FROM restaurants r CROSS JOIN (VALUES('T1','Window two',2),('T2','Garden four',4),('T3','Family six',6),('T4','Main four',4),('T5','Large party',8),('T6','Corner two',2)) AS v(number,name,capacity);
ALTER TABLE reservations ADD COLUMN table_id uuid REFERENCES restaurant_tables(id);
CREATE TABLE table_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),table_id uuid NOT NULL REFERENCES restaurant_tables(id),queue_entry_id uuid NOT NULL REFERENCES queue_entries(id),reservation_id uuid REFERENCES reservations(id),assigned_at timestamptz NOT NULL DEFAULT now(),released_at timestamptz);
CREATE UNIQUE INDEX table_one_active_assignment ON table_assignments(table_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX visit_one_active_assignment ON table_assignments(queue_entry_id) WHERE released_at IS NULL;
CREATE INDEX reservation_table_schedule ON reservations(table_id,starts_at,ends_at);
CREATE TABLE audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES restaurants(id),actor text NOT NULL,action text NOT NULL,entity_id uuid,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
