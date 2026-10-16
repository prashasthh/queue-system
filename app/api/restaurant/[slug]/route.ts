import { endpoint } from "@/lib/http";
import { restaurant } from "@/lib/queue/service";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return endpoint(() => restaurant(slug))(request);
}
