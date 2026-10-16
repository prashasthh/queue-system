import { endpoint } from "@/lib/http";
import { secureEqual } from "@/lib/auth";
import { AppError } from "@/lib/utils/errors";
import { processReservations } from "@/lib/reservations/lifecycle";
import { flushMessages } from "@/lib/whatsapp/outbox";
import { sessionSecret } from "@/lib/visit-token";
import { createHmac } from "node:crypto";
export const POST = endpoint(async (request) => {
  const key =
    process.env.CRON_SECRET ||
    createHmac("sha256", sessionSecret())
      .update("reservation-worker")
      .digest("hex");
  if (!secureEqual(request.headers.get("authorization") || "", `Bearer ${key}`))
    throw new AppError("Worker authentication required", 401);
  const result = await processReservations();
  await flushMessages();
  return result;
});
