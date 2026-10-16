import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { body, endpoint } from "@/lib/http";
import {
  applyManualDiscount,
  createRefund,
  paymentDashboard,
  receiveCash,
} from "@/lib/payments/admin";
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cash"), orderId: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal("refund"),
      paymentId: z.string().uuid(),
      amount: z.number().int().positive(),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("discount"),
      orderId: z.string().uuid(),
      type: z.enum(["percentage", "fixed"]),
      value: z.number().int().positive(),
      reason: z.string().trim().min(3).max(200),
    })
    .strict(),
]);
export const GET = endpoint(async (request) => {
  const s = await requirePermission("payments:manage"),
    url = new URL(request.url),
    now = new Date(),
    from = url.searchParams.get("from") || now.toISOString().slice(0, 10),
    to = url.searchParams.get("to") || from;
  return paymentDashboard(s.restaurantId, from, to);
});
export const POST = endpoint(async (request) => {
  const s = await requirePermission("payments:manage"),
    v = action.parse(await body(request));
  if (v.action === "cash")
    return receiveCash(s.restaurantId, v.orderId, s.staffId);
  if (v.action === "refund") return createRefund(s.restaurantId, v, s.staffId);
  return applyManualDiscount(s.restaurantId, v, s.staffId);
}, true);
