import { requirePermission } from "@/lib/auth";
import { body, endpoint } from "@/lib/http";
import { attendanceInput, listAttendance, recordAttendance } from "@/lib/staff/service";
import { can } from "@/lib/staff/permissions";
import { AppError } from "@/lib/utils/errors";
export const GET=endpoint(async(request)=>{const s=await requirePermission("attendance:view"); const date=new URL(request.url).searchParams.get("date")||undefined; return listAttendance(s.restaurantId,date);});
export const POST=endpoint(async(request)=>{const s=await requirePermission("attendance:view"),input=attendanceInput.parse(await body(request)); if(input.staffId!==s.staffId&&!can(s.role,"attendance:manage")) throw new AppError("You can only record your own attendance",403); return recordAttendance(s.restaurantId,input);},true);
