import { endpoint } from "@/lib/http";
import { requirePermission } from "@/lib/auth";
import { restaurant } from "@/lib/queue/service";
import { feedbackDashboard } from "@/lib/feedback/service";
export const GET = endpoint(async () => {
  await requirePermission("feedback:view");
  return feedbackDashboard((await restaurant("demo-restaurant")).id);
});
