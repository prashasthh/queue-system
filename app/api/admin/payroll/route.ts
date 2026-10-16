import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { body, endpoint } from "@/lib/http";
import {
  adjustPayroll,
  generatePayroll,
  payroll,
  transitionPayroll,
} from "@/lib/payroll/service";
const action = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("generate"),
      periodStart: z.string().date(),
      periodEnd: z.string().date(),
    })
    .strict(),
  z
    .object({
      action: z.literal("adjust"),
      id: z.string().uuid(),
      bonus: z.number().int().min(0),
      deductions: z.number().int().min(0),
      notes: z.string().max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("transition"),
      id: z.string().uuid(),
      status: z.enum(["approved", "paid"]),
    })
    .strict(),
]);
export const GET = endpoint(async () => {
  const s = await requirePermission("payroll:view");
  return payroll(s.restaurantId);
});
export const POST = endpoint(async (request) => {
  const s = await requirePermission("payroll:manage"),
    v = action.parse(await body(request));
  if (v.action === "generate") return generatePayroll(s.restaurantId, v);
  if (v.action === "adjust")
    return adjustPayroll(s.restaurantId, v, s.staffId || "bootstrap-owner");
  return transitionPayroll(s.restaurantId, v, s.staffId);
}, true);
