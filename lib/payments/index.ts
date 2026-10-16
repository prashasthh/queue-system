import type { PaymentProvider } from "./provider";
import { MockPaymentProvider } from "./mock";
import { RazorpayPaymentProvider } from "./razorpay";
export function paymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "razorpay")
    return new RazorpayPaymentProvider();
  if (process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== "mock")
    throw new Error("Unsupported payment provider");
  return new MockPaymentProvider();
}
