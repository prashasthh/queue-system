import { randomUUID } from "node:crypto";
import type { WhatsAppPayload, WhatsAppProvider } from "./provider";
export class MockWhatsAppProvider implements WhatsAppProvider {
  name = "mock" as const;
  async send(payload: WhatsAppPayload) {
    console.info(`[Mock WhatsApp] ${payload.phone}\n${payload.message}`);
    return `mock_wa_${randomUUID()}`;
  }
}
