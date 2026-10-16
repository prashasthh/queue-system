export type MessageType =
  | "queue_joined"
  | "customer_called"
  | "order_confirmed"
  | "payment_successful"
  | "reservation_created"
  | "reservation_confirmation"
  | "reservation_reminder_first"
  | "reservation_reminder_second"
  | "reservation_cancelled"
  | "table_ready"
  | "feedback_request";
export interface WhatsAppPayload {
  phone: string;
  message: string;
  message_type: MessageType;
  template_parameters: string[];
}
export interface WhatsAppProvider {
  name: "mock" | "meta";
  send(payload: WhatsAppPayload): Promise<string>;
}
