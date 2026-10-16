import { endpoint, body } from "@/lib/http";
import { z } from "zod";
import { confirmReservation } from "@/lib/reservations/lifecycle";
import { flushMessages } from "@/lib/whatsapp/outbox";
import { uuid } from "@/lib/validation";
import { customerReservation } from "@/lib/reservations/access";
import { arriveReservation } from "@/lib/reservations/arrival";
import { visitTicket } from "@/lib/visit-token";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const { access_hash: hidden, ...result } = await customerReservation(
      uuid.parse((await params).id),
      new URL(request.url).searchParams.get("token") || "",
    );
    void hidden;
    return result;
  })(request);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = uuid.parse((await params).id),
      input = z
        .union([
          z
            .object({
              answer: z.enum(["yes", "no"]),
              token: z.string().max(300).optional(),
            })
            .strict(),
          z
            .object({
              action: z.literal("arrive"),
              token: z.string().max(300).optional(),
            })
            .strict(),
        ])
        .parse(await body(request));
    await customerReservation(id, input.token);
    if ("action" in input) {
      const result = await arriveReservation(id, "customer");
      await flushMessages();
      return {
        ...result,
        visitUrl: `/visit/${result.id}?token=${encodeURIComponent(visitTicket(result.id))}`,
      };
    }
    const result = await confirmReservation(id, input.answer);
    await flushMessages();
    return result;
  }, true)(request);
}
