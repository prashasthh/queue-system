import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db";
import { authenticateStaff, createStaff, listAttendance, recordAttendance, updateStaff } from "../lib/staff/service";
import { can } from "../lib/staff/permissions";

test("staff credentials, roles and attendance are enforced", async()=>{
  process.env.DB_PROVIDER="pglite"; process.env.PGLITE_DATA_DIR="memory://";
  const db=await getDb(),restaurantId="00000000-0000-4000-8000-000000000001";
  try {
    const staff=await createStaff(restaurantId,{name:"Riya Host",phone:"9876543211",email:"riya@example.com",password:"secure-pass-123",role:"reception",joinedOn:"2026-10-10",shiftStart:"10:00",shiftEnd:"18:00"});
    assert.equal(staff.phone,"+919876543211");
    assert.equal((await authenticateStaff("riya@example.com","wrong")),null);
    assert.equal((await authenticateStaff("RIYA@example.com","secure-pass-123"))?.role,"reception");
    assert.equal(can("reception","queue:manage"),true);
    assert.equal(can("reception","menu:manage"),false);
    await recordAttendance(restaurantId,{staffId:staff.id,date:"2026-10-10",status:"present",notes:"On time",clockIn:"2026-10-10T04:30:00.000Z",clockOut:null});
    await recordAttendance(restaurantId,{staffId:staff.id,date:"2026-10-10",status:"present",notes:"Shift complete",clockIn:null,clockOut:"2026-10-10T12:30:00.000Z"});
    const rows=await listAttendance(restaurantId,"2026-10-10") as {clock_in:string;clock_out:string;notes:string}[];
    assert.equal(rows.length,1); assert(rows[0].clock_in); assert(rows[0].clock_out); assert.equal(rows[0].notes,"Shift complete");
    await updateStaff(restaurantId,staff.id,{status:"inactive"});
    assert.equal(await authenticateStaff("riya@example.com","secure-pass-123"),null);
  } finally { await db.close(); }
});
