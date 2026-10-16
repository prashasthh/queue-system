import { endpoint } from "@/lib/http";
import { requireVisit } from "@/lib/auth";
import { uuid } from "@/lib/validation";
import { queueEntry } from "@/lib/queue/service";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = uuid.parse((await params).id);
    await requireVisit(id);
    return queueEntry(id);
  })(request);
}
