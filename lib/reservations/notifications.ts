import type { Sql } from "../db";
import type { Reservation } from "./service";
import type { MessageType } from "../whatsapp/provider";
import { appUrl } from "../whatsapp/outbox";
import { visitTicket } from "../visit-token";
export async function notifyReservation(
  tx: Sql,
  r: Reservation,
  type: MessageType,
  text: string,
) {
  const url = `${appUrl()}/reservation/${r.id}?token=${visitTicket(`reservation:${r.id}`, new Date(r.ends_at).getTime() + 86400000)}`;
  const when = new Date(r.starts_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  await tx.query(
    "INSERT INTO whatsapp_messages(customer_id,reservation_id,phone,message_type,message,template_parameters,event_key) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT(event_key) DO NOTHING",
    [
      r.customer_id,
      r.id,
      r.phone,
      type,
      `${r.restaurant_name}\n${text}\nReservation: ${when} IST · ${r.party_size} guests\nPrivate confirmation link (choose YES or NO): ${url}`,
      JSON.stringify([r.restaurant_name, when, url]),
      `${type}:${r.id}`,
    ],
  );
}
