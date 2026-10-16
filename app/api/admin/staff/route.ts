import { requirePermission } from "@/lib/auth";
import { body, endpoint } from "@/lib/http";
import { createStaff, listStaff } from "@/lib/staff/service";
export const GET=endpoint(async()=>{const s=await requirePermission("staff:view"); return listStaff(s.restaurantId);});
export const POST=endpoint(async(request)=>{const s=await requirePermission("staff:manage"); return createStaff(s.restaurantId,await body(request));},true);
