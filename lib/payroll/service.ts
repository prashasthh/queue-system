import { z } from "zod";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/utils/errors";
import { audit } from "@/lib/audit";
export const periodInput = z
  .object({ periodStart: z.string().date(), periodEnd: z.string().date() })
  .refine((v) => v.periodStart <= v.periodEnd, "Invalid pay period");
export const adjustmentInput = z
  .object({
    id: z.string().uuid(),
    bonus: z.number().int().min(0).max(100000000),
    deductions: z.number().int().min(0).max(100000000),
    notes: z.string().trim().max(500),
  })
  .strict();
export const transitionInput = z
  .object({ id: z.string().uuid(), status: z.enum(["approved", "paid"]) })
  .strict();
export async function payroll(restaurantId: string) {
  return (await getDb()).query(
    `SELECT p.*,s.name,s.role FROM payroll_records p JOIN staff_users s ON s.id=p.staff_id WHERE p.restaurant_id=$1 ORDER BY p.period_start DESC,s.name`,
    [restaurantId],
  );
}
export async function generatePayroll(restaurantId: string, raw: unknown) {
  const v = periodInput.parse(raw),
    start = new Date(`${v.periodStart}T00:00:00Z`),
    end = new Date(`${v.periodEnd}T00:00:00Z`),
    periodDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (periodDays > 366) throw new AppError("Pay period cannot exceed one year");
  return (await getDb()).transaction(async (tx) => {
    const staff = await tx.query<{ id: string; base_salary: number }>(
      "SELECT id,base_salary FROM staff_users WHERE restaurant_id=$1 AND status='active'",
      [restaurantId],
    );
    for (const s of staff) {
      const [a] = await tx.query<{
        attendance_days: number;
        paid_leave_days: number;
        unpaid_leave_days: number;
      }>(
        `SELECT coalesce(sum(CASE WHEN status IN ('present','late') THEN 1 WHEN status='half_day' THEN .5 ELSE 0 END),0)::numeric attendance_days,coalesce(sum(CASE WHEN status='leave' THEN 1 ELSE 0 END),0)::numeric paid_leave_days,coalesce(sum(CASE WHEN status='absent' THEN 1 ELSE 0 END),0)::numeric unpaid_leave_days FROM staff_attendance WHERE staff_id=$1 AND attendance_date BETWEEN $2 AND $3`,
        [s.id, v.periodStart, v.periodEnd],
      );
      const payable = Number(a.attendance_days) + Number(a.paid_leave_days),
        earned = Math.round(
          (s.base_salary * Math.min(payable, periodDays)) / periodDays,
        );
      await tx.query(
        `INSERT INTO payroll_records(restaurant_id,staff_id,period_start,period_end,base_salary,attendance_days,paid_leave_days,unpaid_leave_days,earned_salary,net_payable) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) ON CONFLICT(staff_id,period_start,period_end) DO UPDATE SET base_salary=excluded.base_salary,attendance_days=excluded.attendance_days,paid_leave_days=excluded.paid_leave_days,unpaid_leave_days=excluded.unpaid_leave_days,earned_salary=excluded.earned_salary,net_payable=greatest(0,excluded.earned_salary+payroll_records.bonus-payroll_records.deductions),updated_at=now() WHERE payroll_records.status='draft'`,
        [
          restaurantId,
          s.id,
          v.periodStart,
          v.periodEnd,
          s.base_salary,
          a.attendance_days,
          a.paid_leave_days,
          a.unpaid_leave_days,
          earned,
        ],
      );
    }
    return tx.query(
      `SELECT p.*,s.name,s.role FROM payroll_records p JOIN staff_users s ON s.id=p.staff_id WHERE p.restaurant_id=$1 ORDER BY p.period_start DESC,s.name`,
      [restaurantId],
    );
  });
}
export async function adjustPayroll(
  restaurantId: string,
  raw: unknown,
  actor: string,
) {
  const v = adjustmentInput.parse(raw);
  return (await getDb()).transaction(async (tx) => {
    const [row] = await tx.query<{ id: string; earned_salary: number }>(
      "SELECT id,earned_salary FROM payroll_records WHERE id=$1 AND restaurant_id=$2 AND status='draft' FOR UPDATE",
      [v.id, restaurantId],
    );
    if (!row) throw new AppError("Only draft payroll can be adjusted", 409);
    const [updated] = await tx.query(
      "UPDATE payroll_records SET bonus=$2,deductions=$3,notes=$4,net_payable=greatest(0,earned_salary+$2-$3),updated_at=now() WHERE id=$1 RETURNING *",
      [v.id, v.bonus, v.deductions, v.notes],
    );
    await audit(tx, restaurantId, actor, "payroll_adjusted", v.id, {
      bonus: v.bonus,
      deductions: v.deductions,
    });
    return updated;
  });
}
export async function transitionPayroll(
  restaurantId: string,
  raw: unknown,
  staffId: string | null,
) {
  const v = transitionInput.parse(raw);
  return (await getDb()).transaction(async (tx) => {
    const [row] = await tx.query<{ status: string }>(
      "SELECT status FROM payroll_records WHERE id=$1 AND restaurant_id=$2 FOR UPDATE",
      [v.id, restaurantId],
    );
    if (!row) throw new AppError("Payroll record not found", 404);
    if (
      (v.status === "approved" && row.status !== "draft") ||
      (v.status === "paid" && row.status !== "approved")
    )
      throw new AppError(
        `Cannot change ${row.status} payroll to ${v.status}`,
        409,
      );
    const [updated] = await tx.query(
      "UPDATE payroll_records SET status=$2,approved_by=CASE WHEN $2='approved' THEN $3 ELSE approved_by END,approved_at=CASE WHEN $2='approved' THEN now() ELSE approved_at END,paid_at=CASE WHEN $2='paid' THEN now() ELSE paid_at END,updated_at=now() WHERE id=$1 RETURNING *",
      [v.id, v.status, staffId],
    );
    await audit(
      tx,
      restaurantId,
      staffId || "bootstrap-owner",
      `payroll_${v.status}`,
      v.id,
      { status: v.status },
    );
    return updated;
  });
}
