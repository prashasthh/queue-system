import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { body, endpoint } from "@/lib/http";
import { restaurant } from "@/lib/queue/service";
import {
  adminMenu,
  deactivateMenu,
  saveCategory,
  saveItem,
  saveSchedule,
} from "@/lib/menu/service";

async function restaurantId() {
  return (await restaurant("demo-restaurant")).id;
}
export const GET = endpoint(async () => {
  await requirePermission("menu:view");
  return adminMenu(await restaurantId());
});
export const POST = endpoint(async (request) => {
  await requirePermission("menu:manage");
  const input = z
    .object({
      entity: z.enum(["category", "item", "schedule"]),
      value: z.unknown(),
    })
    .strict()
    .parse(await body(request));
  const id = await restaurantId();
  if (input.entity === "category") return saveCategory(id, input.value);
  if (input.entity === "item") return saveItem(id, input.value);
  return saveSchedule(id, input.value);
}, true);
export const DELETE = endpoint(async (request) => {
  await requirePermission("menu:manage");
  const input = z
    .object({
      entity: z.enum(["category", "item", "schedule"]),
      id: z.string().uuid(),
    })
    .strict()
    .parse(await body(request));
  return deactivateMenu(await restaurantId(), input.entity, input.id);
}, true);
