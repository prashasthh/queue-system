import { endpoint } from "@/lib/http";
import { uuid } from "@/lib/validation";
import { customerOrder } from "@/lib/orders/access";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => customerOrder(uuid.parse((await params).id)))(
    req,
  );
}
