import { requireVisit } from "../auth";
import { order } from "./service";
export async function customerOrder(id: string) {
  const result = await order(id);
  await requireVisit(result.queue_entry_id);
  return result;
}
