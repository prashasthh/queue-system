import { z } from "zod";
import { getDb } from "@/lib/db";
import { phone } from "@/lib/validation";
import { AppError } from "@/lib/utils/errors";
import { hashPassword, verifyPassword } from "./password";

export const staffRoles = ["owner", "manager", "reception", "waiter", "kitchen", "cashier"] as const;
export type StaffRole = (typeof staffRoles)[number];
export const attendanceStatuses = ["present", "absent", "late", "half_day", "leave"] as const;

const email = z.string().trim().toLowerCase().email().max(200);
export const staffInput = z.object({
  name: z.string().trim().min(2).max(80), phone, email,
  password: z.string().min(8).max(200), role: z.enum(staffRoles),
  joinedOn: z.string().date(), shiftStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  shiftEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  baseSalary: z.number().int().min(0).max(100000000).default(0),
}).strict();
export const staffUpdateInput = staffInput.partial().extend({
  password: z.string().min(8).max(200).optional(), status: z.enum(["active", "inactive"]).optional(),
}).strict();
export const attendanceInput = z.object({
  staffId: z.string().uuid(), date: z.string().date(), status: z.enum(attendanceStatuses),
  notes: z.string().trim().max(500).default(""), clockIn: z.string().datetime().nullable().default(null),
  clockOut: z.string().datetime().nullable().default(null),
}).strict();

export interface StaffUser { id:string; restaurant_id:string; name:string; phone:string; email:string; role:StaffRole; status:"active"|"inactive"; joined_on:string; shift_start:string|null; shift_end:string|null; base_salary:number; created_at:string; updated_at:string }
const columns = "id,restaurant_id,name,phone,email,role,status,joined_on,shift_start,shift_end,base_salary,created_at,updated_at";

export async function listStaff(restaurantId: string) {
  return (await getDb()).query<StaffUser>(`SELECT ${columns} FROM staff_users WHERE restaurant_id=$1 ORDER BY status,name`, [restaurantId]);
}
export async function createStaff(restaurantId: string, raw: unknown) {
  const v = staffInput.parse(raw), passwordHash = await hashPassword(v.password);
  try {
    const [row] = await (await getDb()).query<StaffUser>(`INSERT INTO staff_users(restaurant_id,name,phone,email,password_hash,role,joined_on,shift_start,shift_end,base_salary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${columns}`,[restaurantId,v.name,v.phone,v.email,passwordHash,v.role,v.joinedOn,v.shiftStart,v.shiftEnd,v.baseSalary]);
    return row;
  } catch (error) {
    if ((error as {code?:string}).code === "23505") throw new AppError("A staff account already uses that email or phone",409);
    throw error;
  }
}
export async function updateStaff(restaurantId:string,id:string,raw:unknown) {
  const v=staffUpdateInput.parse(raw), entries=Object.entries(v).filter(([,value])=>value!==undefined);
  if (!entries.length) throw new AppError("No staff changes supplied");
  const map:Record<string,string>={name:"name",phone:"phone",email:"email",role:"role",status:"status",joinedOn:"joined_on",shiftStart:"shift_start",shiftEnd:"shift_end",baseSalary:"base_salary",password:"password_hash"};
  const values:unknown[]=[restaurantId,id]; const sets:string[]=[];
  for (const [key,value] of entries) { values.push(key==="password"?await hashPassword(value as string):value); sets.push(`${map[key]}=$${values.length}`); }
  try {
    const [row]=await (await getDb()).query<StaffUser>(`UPDATE staff_users SET ${sets.join(",")},updated_at=now() WHERE restaurant_id=$1 AND id=$2 RETURNING ${columns}`,values);
    if(!row) throw new AppError("Staff member not found",404); return row;
  } catch(error) { if((error as {code?:string}).code==="23505") throw new AppError("A staff account already uses that email or phone",409); throw error; }
}
export async function authenticateStaff(emailAddress:string,password:string) {
  const [row]=await (await getDb()).query<StaffUser & {password_hash:string}>(`SELECT ${columns},password_hash FROM staff_users WHERE lower(email)=lower($1) AND status='active'`,[email.parse(emailAddress)]);
  if(!row || !(await verifyPassword(password,row.password_hash))) return null;
  const safe:Omit<typeof row,"password_hash">={id:row.id,restaurant_id:row.restaurant_id,name:row.name,phone:row.phone,email:row.email,role:row.role,status:row.status,joined_on:row.joined_on,shift_start:row.shift_start,shift_end:row.shift_end,base_salary:row.base_salary,created_at:row.created_at,updated_at:row.updated_at}; return safe;
}
export async function listAttendance(restaurantId:string,date?:string) {
  return (await getDb()).query(`SELECT a.*,s.name,s.role,s.shift_start,s.shift_end FROM staff_attendance a JOIN staff_users s ON s.id=a.staff_id WHERE a.restaurant_id=$1 ${date?"AND a.attendance_date=$2":""} ORDER BY a.attendance_date DESC,s.name`,date?[restaurantId,date]:[restaurantId]);
}
export async function recordAttendance(restaurantId:string,raw:unknown) {
  const v=attendanceInput.parse(raw);
  let clockIn=v.clockIn;
  if(v.clockOut&&!clockIn){const [existing]=await (await getDb()).query<{clock_in:string|null}>("SELECT clock_in FROM staff_attendance WHERE restaurant_id=$1 AND staff_id=$2 AND attendance_date=$3",[restaurantId,v.staffId,v.date]); if(!existing?.clock_in) throw new AppError("Clock in must be recorded before clock out",409); clockIn=existing.clock_in;}
  const [row]=await (await getDb()).query(`INSERT INTO staff_attendance(restaurant_id,staff_id,attendance_date,status,notes,clock_in,clock_out) SELECT $1,id,$3,$4,$5,$6,$7 FROM staff_users WHERE id=$2 AND restaurant_id=$1 ON CONFLICT(staff_id,attendance_date) DO UPDATE SET status=excluded.status,notes=excluded.notes,clock_in=coalesce(excluded.clock_in,staff_attendance.clock_in),clock_out=coalesce(excluded.clock_out,staff_attendance.clock_out),updated_at=now() RETURNING *`,[restaurantId,v.staffId,v.date,v.status,v.notes,clockIn,v.clockOut]);
  if(!row) throw new AppError("Staff member not found",404); return row;
}
