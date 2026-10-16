import { endpoint, body } from "@/lib/http";
import {
  adminPassword,
  secureEqual,
  setAdminSession,
  rateLimit,
  requestIp,
  logout,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { AppError } from "@/lib/utils/errors";
import { authenticateStaff } from "@/lib/staff/service";
export const POST = endpoint(async (req) => {
  await rateLimit(`login:${requestIp(req)}`, 10, 900);
  const { password, email } = loginSchema.parse(await body(req));
  if (email) {
    const staff=await authenticateStaff(email,password);
    if(!staff) throw new AppError("Incorrect email or password",401);
    await setAdminSession({staffId:staff.id,restaurantId:staff.restaurant_id,name:staff.name,role:staff.role});
  } else {
    if (!secureEqual(password, adminPassword())) throw new AppError("Incorrect staff password", 401);
    await setAdminSession();
  }
  return { ok: true };
}, true);
export const DELETE = endpoint(async () => {
  await logout();
  return { ok: true };
}, true);
