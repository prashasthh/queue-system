ALTER TABLE menu_categories ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE menu_categories ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE menu_items ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE menu_items ADD COLUMN sold_out boolean NOT NULL DEFAULT false;
ALTER TABLE menu_items ADD COLUMN item_type text NOT NULL DEFAULT 'item' CHECK(item_type IN ('item','combo'));
CREATE TABLE menu_combo_items (
 combo_item_id uuid NOT NULL REFERENCES menu_items(id), component_item_id uuid NOT NULL REFERENCES menu_items(id),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 20), PRIMARY KEY(combo_item_id,component_item_id), CHECK(combo_item_id<>component_item_id)
);
CREATE TABLE menu_schedules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES restaurants(id), name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
 start_time time NOT NULL, end_time time NOT NULL, days smallint[] NOT NULL CHECK(cardinality(days) BETWEEN 1 AND 7), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(restaurant_id,name), CHECK(start_time<>end_time)
);
CREATE TABLE menu_schedule_categories (
 schedule_id uuid NOT NULL REFERENCES menu_schedules(id) ON DELETE CASCADE, category_id uuid NOT NULL REFERENCES menu_categories(id), PRIMARY KEY(schedule_id,category_id)
);
CREATE TABLE menu_schedule_items (
 schedule_id uuid NOT NULL REFERENCES menu_schedules(id) ON DELETE CASCADE, menu_item_id uuid NOT NULL REFERENCES menu_items(id), PRIMARY KEY(schedule_id,menu_item_id)
);
CREATE INDEX menu_schedule_restaurant_idx ON menu_schedules(restaurant_id,active);
ALTER TABLE menu_combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_schedule_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_schedule_items ENABLE ROW LEVEL SECURITY;
