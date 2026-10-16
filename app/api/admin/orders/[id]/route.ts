import { endpoint, body } from "@/lib/http";
import { requirePermission } from "@/lib/auth";
import { uuid, orderStatusSchema } from "@/lib/validation";
import { changeOrder } from "@/lib/orders/service";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async (request) => {
    await requirePermission("orders:manage");
    const { status } = orderStatusSchema.parse(await body(request));
    return changeOrder(uuid.parse((await params).id), status);
  }, true)(req);
}
