ALTER TABLE staff_users ADD COLUMN base_salary integer NOT NULL DEFAULT 0 CHECK(base_salary>=0);
CREATE TABLE payroll_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES restaurants(id),staff_id uuid NOT NULL REFERENCES staff_users(id),
 period_start date NOT NULL,period_end date NOT NULL,base_salary integer NOT NULL CHECK(base_salary>=0),attendance_days numeric(6,2) NOT NULL DEFAULT 0,
 paid_leave_days numeric(6,2) NOT NULL DEFAULT 0,unpaid_leave_days numeric(6,2) NOT NULL DEFAULT 0,earned_salary integer NOT NULL CHECK(earned_salary>=0),
 bonus integer NOT NULL DEFAULT 0 CHECK(bonus>=0),deductions integer NOT NULL DEFAULT 0 CHECK(deductions>=0),net_payable integer NOT NULL CHECK(net_payable>=0),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','paid')),approved_by uuid REFERENCES staff_users(id),approved_at timestamptz,
 paid_at timestamptz,notes text NOT NULL DEFAULT '' CHECK(length(notes)<=500),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(period_end>=period_start),UNIQUE(staff_id,period_start,period_end)
);
CREATE INDEX payroll_restaurant_period_idx ON payroll_records(restaurant_id,period_start DESC,status);
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
