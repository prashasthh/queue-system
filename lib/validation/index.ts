import { z } from "zod";
export const uuid = z.string().uuid();
export const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .transform((v) =>
    /^\d{10}$/.test(v) ? `+91${v}` : /^91\d{10}$/.test(v) ? `+${v}` : v,
  )
  .pipe(
    z.string().regex(/^\+91[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
  );
export const joinSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(
        /^[\p{L}\p{M} .'-]+$/u,
        "Use letters, spaces or basic punctuation",
      ),
    phone,
    partySize: z.number().int().min(1).max(20),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80),
    requestId: uuid,
    consent: z.literal(true, {
      error: "Please agree to receive visit updates",
    }),
  })
  .strict();
export const queueStatusSchema = z
  .object({
    status: z.enum(["waiting", "called", "seated", "completed", "cancelled"]),
  })
  .strict();
export const orderSchema = z
  .object({
    queueEntryId: uuid,
    requestId: uuid,
    items: z
      .array(
        z
          .object({
            menuItemId: uuid,
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict()
  .refine(
    (v) => new Set(v.items.map((i) => i.menuItemId)).size === v.items.length,
    "Duplicate menu items are not allowed",
  );
export const orderStatusSchema = z
  .object({ status: z.enum(["confirmed", "preparing", "ready", "completed"]) })
  .strict();
export const loginSchema = z
  .object({ password: z.string().min(1).max(200), email: z.string().trim().email().max(200).optional() })
  .strict();
export const mockPaymentSchema = z
  .object({ result: z.enum(["success", "failed"]) })
  .strict();
export const verifySchema = z
  .object({
    razorpay_order_id: z.string().min(1).max(100),
    razorpay_payment_id: z.string().min(1).max(100),
    razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
