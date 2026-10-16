import { z } from "zod";
import type { PaymentProvider } from "./provider";
import { AppError } from "../utils/errors";
import { validHmac } from "./signature";
const paymentSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
});
export class RazorpayPaymentProvider implements PaymentProvider {
  name = "razorpay" as const;
  private credentials() {
    const key = process.env.RAZORPAY_KEY_ID,
      secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) throw new AppError("Razorpay is not configured", 503);
    return { key, secret };
  }
  private async request(path: string, data?: unknown) {
    const { key, secret } = this.credentials();
    const res = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: data ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok)
      throw new AppError(
        "Payment provider is unavailable. Please try again.",
        502,
      );
    return res.json();
  }
  async create(amount: number, receipt: string) {
    const result = z
      .object({
        id: z.string(),
        amount: z.number().int(),
        currency: z.literal("INR"),
      })
      .parse(
        await this.request("orders", {
          amount,
          currency: "INR",
          receipt,
          partial_payment: false,
        }),
      );
    if (result.amount !== amount)
      throw new AppError("Payment provider amount mismatch", 502);
    return { id: result.id };
  }
  async refund(paymentId: string, amount: number, reason: string) {
    const result = z
      .object({
        id: z.string(),
        payment_id: z.string(),
        amount: z.number().int(),
        currency: z.literal("INR"),
      })
      .parse(
        await this.request(`payments/${encodeURIComponent(paymentId)}/refund`, {
          amount,
          notes: { reason: reason.slice(0, 256) },
        }),
      );
    if (result.payment_id !== paymentId || result.amount !== amount)
      throw new AppError("Refund provider amount mismatch", 502);
    return { id: result.id };
  }
  verifySignature(orderId: string, paymentId: string, signature: string) {
    return validHmac(
      `${orderId}|${paymentId}`,
      signature,
      this.credentials().secret,
    );
  }
  async capturedPayment(paymentId: string, orderId: string, amount: number) {
    const p = paymentSchema.parse(
      await this.request(`payments/${encodeURIComponent(paymentId)}`),
    );
    if (
      p.id !== paymentId ||
      p.order_id !== orderId ||
      p.amount !== amount ||
      p.currency !== "INR" ||
      p.status !== "captured"
    )
      throw new AppError(
        "Payment is not captured or does not match this order. Wait for confirmation before retrying.",
        409,
      );
    return p;
  }
}
