CREATE TABLE staff_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),phone text NOT NULL CHECK(phone ~ '^\+91[6-9][0-9]{9}$'),
 email text NOT NULL,password_hash text NOT NULL,role text NOT NULL CHECK(role IN ('owner','manager','reception','waiter','kitchen','cashier')),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),joined_on date NOT NULL DEFAULT current_date,
 shift_start time,shift_end time,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(restaurant_id,email),UNIQUE(restaurant_id,phone),UNIQUE(id,restaurant_id)
);
CREATE INDEX staff_users_restaurant_idx ON staff_users(restaurant_id,status,role,name);
CREATE TABLE staff_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES restaurants(id),staff_id uuid NOT NULL,
 attendance_date date NOT NULL DEFAULT current_date,status text NOT NULL CHECK(status IN ('present','absent','late','half_day','leave')),
 clock_in timestamptz,clock_out timestamptz,notes text NOT NULL DEFAULT '' CHECK(length(notes)<=500),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(staff_id,restaurant_id) REFERENCES staff_users(id,restaurant_id),UNIQUE(staff_id,attendance_date),
 CHECK(clock_out IS NULL OR (clock_in IS NOT NULL AND clock_out>=clock_in))
);
CREATE INDEX staff_attendance_restaurant_idx ON staff_attendance(restaurant_id,attendance_date DESC,status);
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
