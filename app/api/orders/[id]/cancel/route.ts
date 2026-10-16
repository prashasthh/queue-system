import { endpoint } from "@/lib/http";
import { uuid } from "@/lib/validation";
import { customerOrder } from "@/lib/orders/access";
import { cancelDraft } from "@/lib/orders/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = uuid.parse((await params).id);
    await customerOrder(id);
    return cancelDraft(id);
  }, true)(request);
}
