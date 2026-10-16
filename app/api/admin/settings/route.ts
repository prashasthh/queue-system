import { requirePermission } from "@/lib/auth";
import { body, endpoint } from "@/lib/http";
import { restaurant } from "@/lib/queue/service";
import {
  settings,
  settingsSchema,
  updateSettings,
} from "@/lib/settings/service";
export const GET = endpoint(async () => {
  await requirePermission("settings:manage");
  return settings((await restaurant("demo-restaurant")).id);
});
export const PATCH = endpoint(async (request) => {
  await requirePermission("settings:manage");
  return updateSettings(
    (await restaurant("demo-restaurant")).id,
    settingsSchema.parse(await body(request)),
  );
}, true);
