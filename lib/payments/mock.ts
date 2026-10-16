import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "./provider";
export class MockPaymentProvider implements PaymentProvider {
  name = "mock" as const;
  async create() {
    return { id: `mock_order_${randomUUID()}` };
  }
  async refund() {
    return { id: `mock_refund_${randomUUID()}` };
  }
}
