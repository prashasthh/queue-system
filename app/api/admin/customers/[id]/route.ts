import { endpoint } from "@/lib/http";
import { requirePermission } from "@/lib/auth";
import { uuid } from "@/lib/validation";
import { restaurant } from "@/lib/queue/service";
import { customerDetail } from "@/lib/customers/service";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    await requirePermission("customers:view");
    return customerDetail(
      (await restaurant("demo-restaurant")).id,
      uuid.parse((await params).id),
    );
  })(request);
}
