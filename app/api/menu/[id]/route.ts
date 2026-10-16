import { endpoint } from "@/lib/http";
import { requireVisit } from "@/lib/auth";
import { uuid } from "@/lib/validation";
import { menu } from "@/lib/orders/service";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = uuid.parse((await params).id);
    await requireVisit(id);
    return menu(id);
  })(req);
}
