import { endpoint } from "@/lib/http";
import { requirePermission } from "@/lib/auth";
import { restaurant } from "@/lib/queue/service";
import { customerProfiles } from "@/lib/customers/service";
export const GET = endpoint(async (request) => {
  await requirePermission("customers:view");
  const search =
    new URL(request.url).searchParams.get("search")?.trim().slice(0, 80) || "";
  return customerProfiles((await restaurant("demo-restaurant")).id, search);
});
