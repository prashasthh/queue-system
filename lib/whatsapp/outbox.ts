import { getDb, type Sql } from "../db";
import type { QueueEntry } from "@/types";
import type { MessageType, WhatsAppPayload } from "./provider";
import { whatsappProvider } from "./index";
import { visitTicket } from "../visit-token";
export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
export async function enqueue(
  tx: Sql,
  q: QueueEntry,
  type: MessageType,
  message: string,
  parameters: string[],
  eventKey: string,
  orderId: string | null = null,
) {
  await tx.query(
    `INSERT INTO whatsapp_messages(customer_id,queue_entry_id,order_id,phone,message_type,message,template_parameters,event_key)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT(event_key) DO NOTHING`,
    [
      q.customer_id,
      q.id,
      orderId,
      q.phone,
      type,
      message,
      JSON.stringify(parameters),
      eventKey,
    ],
  );
}
export async function queueNotification(
  tx: Sql,
  q: QueueEntry,
  called = false,
) {
  const url = `${appUrl()}/visit/${q.id}?token=${visitTicket(q.id)}`;
  if (called)
    await enqueue(
      tx,
      q,
      "customer_called",
      `Your table is almost ready 🎉\n\nQueue number: ${q.queue_number}\n\nView the menu with your private visit link (do not share):\n${url}`,
      [q.queue_number, url],
      `called:${q.id}:${new Date(q.called_at!).toISOString()}`,
    );
  else
    await enqueue(
      tx,
      q,
      "queue_joined",
      `Welcome to ${q.restaurant_name} 👋\n\nYour queue number is ${q.queue_number}.\n\nThere are ${q.people_ahead} parties ahead of you.\n\nWe'll message you when your turn is coming.`,
      [q.restaurant_name, q.queue_number, String(q.people_ahead)],
      `joined:${q.id}`,
    );
}
// At-least-once delivery. The durable outbox preserves failures for staff retry.
export async function flushMessages() {
  try {
    const db = await getDb();
    const provider = whatsappProvider();
    const messages = await db.transaction(async (tx) => {
      const rows = await tx.query<WhatsAppPayload & { id: string }>(
        "SELECT id,phone,message,message_type,template_parameters FROM whatsapp_messages WHERE (status IN ('pending','failed') OR (status='sending' AND updated_at<now()-interval '2 minutes')) AND attempts<5 ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED",
      );
      for (const row of rows)
        await tx.query(
          "UPDATE whatsapp_messages SET status='sending',attempts=attempts+1,provider=$2,updated_at=now() WHERE id=$1",
          [row.id, provider.name],
        );
      return rows;
    });
    await Promise.all(
      messages.map(async (row) => {
        try {
          const id = await provider.send(row);
          await db.query(
            "UPDATE whatsapp_messages SET status='sent',provider_message_id=$2,last_error=NULL,updated_at=now() WHERE id=$1",
            [row.id, id],
          );
        } catch (error) {
          console.error(
            "[WhatsApp send failed]",
            row.id,
            error instanceof Error ? error.message : "provider error",
          );
          await db.query(
            "UPDATE whatsapp_messages SET status='failed',last_error='Provider request failed; check server logs',updated_at=now() WHERE id=$1",
            [row.id],
          );
        }
      }),
    );
  } catch (error) {
    console.error(
      "[WhatsApp outbox deferred]",
      error instanceof Error ? error.message : "unavailable",
    );
  }
}
