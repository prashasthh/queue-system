import { endpoint } from "@/lib/http";
import { uuid } from "@/lib/validation";
import { customerOrder } from "@/lib/orders/access";
import { paymentProvider } from "@/lib/payments";
import { startPayment } from "@/lib/payments/service";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    await customerOrder(uuid.parse((await params).id));
    return {
      provider: paymentProvider().name,
      keyId: process.env.RAZORPAY_KEY_ID || "",
    };
  })(req);
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = uuid.parse((await params).id);
    await customerOrder(id);
    return startPayment(id);
  }, true)(req);
}
