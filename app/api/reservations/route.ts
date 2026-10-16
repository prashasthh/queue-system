import { endpoint, body } from "@/lib/http";
import { flushMessages } from "@/lib/whatsapp/outbox";
import { customerToken, hash, rateLimit, requestIp } from "@/lib/auth";
import {
  createReservation,
  reservationSchema,
} from "@/lib/reservations/service";
export const POST = endpoint(async (request) => {
  const input = reservationSchema.parse(await body(request));
  await rateLimit(`reservation:${requestIp(request)}`, 30, 600);
  const row = await createReservation(input, hash(await customerToken(true)));
  await flushMessages();
  const { access_hash: hidden, ...result } = row;
  void hidden;
  return result;
}, true);
