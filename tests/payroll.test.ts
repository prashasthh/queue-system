import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db";
import { createStaff, recordAttendance } from "../lib/staff/service";
import {
  adjustPayroll,
  generatePayroll,
  payroll,
  transitionPayroll,
} from "../lib/payroll/service";
test("payroll uses attendance and follows draft approval paid states", async () => {
  process.env.DB_PROVIDER = "pglite";
  process.env.PGLITE_DATA_DIR = "memory://";
  const db = await getDb(),
    restaurantId = "00000000-0000-4000-8000-000000000001";
  try {
    const staff = await createStaff(restaurantId, {
      name: "Payroll Cook",
      phone: "+919822222228",
      email: "payroll@example.com",
      password: "secure-payroll",
      role: "kitchen",
      joinedOn: "2026-10-01",
      shiftStart: "10:00",
      shiftEnd: "18:00",
      baseSalary: 3000000,
    });
    for (const date of ["2026-10-01", "2026-10-02"])
      await recordAttendance(restaurantId, {
        staffId: staff.id,
        date,
        status: "present",
        notes: "",
        clockIn: null,
        clockOut: null,
      });
    await generatePayroll(restaurantId, {
      periodStart: "2026-10-01",
      periodEnd: "2026-10-02",
    });
    let [row] = (await payroll(restaurantId)) as {
      id: string;
      earned_salary: number;
      net_payable: number;
      status: string;
    }[];
    assert.equal(row.earned_salary, 3000000);
    await adjustPayroll(
      restaurantId,
      { id: row.id, bonus: 10000, deductions: 5000, notes: "Performance" },
      "owner",
    );
    await transitionPayroll(
      restaurantId,
      { id: row.id, status: "approved" },
      null,
    );
    await transitionPayroll(restaurantId, { id: row.id, status: "paid" }, null);
    [row] = (await payroll(restaurantId)) as (typeof row)[];
    assert.equal(row.net_payable, 3005000);
    assert.equal(row.status, "paid");
  } finally {
    await db.close();
  }
});
