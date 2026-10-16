import { z } from "zod";
import { body, endpoint } from "@/lib/http";
import { uuid } from "@/lib/validation";
import { priorityAccess } from "@/lib/priority/access";
import { createPriority, priorityOffer } from "@/lib/priority/service";
const target = z.object({ kind: z.enum(["queue", "reservation"]), id: uuid });
export const GET = endpoint(async (request) => {
  const input = target.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  await priorityAccess(input.kind, input.id);
  return priorityOffer(input.kind, input.id);
});
export const POST = endpoint(async (request) => {
  const input = target
    .extend({ type: z.enum(["vip", "commitment"]) })
    .strict()
    .parse(await body(request));
  await priorityAccess(input.kind, input.id);
  return createPriority(input.kind, input.id, input.type);
}, true);
