export interface PaymentProvider {
  name: "mock" | "razorpay";
  create(amount: number, receipt: string): Promise<{ id: string }>;
  refund(paymentId: string, amount: number, reason: string): Promise<{ id: string }>;
}
export interface PaymentRecord {
  id: string;
  order_id: string;
  provider: "mock" | "razorpay" | "credit" | "cash";
  provider_order_id: string;
  provider_payment_id: string | null;
  amount: number;
  status: string;
}
