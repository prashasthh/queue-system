import { requirePermission } from "@/lib/auth";
import { body, endpoint } from "@/lib/http";
import { updateStaff } from "@/lib/staff/service";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) { return endpoint(async(req)=>{const s=await requirePermission("staff:manage"); return updateStaff(s.restaurantId,(await params).id,await body(req));},true)(request); }
