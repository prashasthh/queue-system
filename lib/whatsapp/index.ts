import type { WhatsAppProvider } from "./provider";
import { MockWhatsAppProvider } from "./mock";
import { MetaWhatsAppProvider } from "./meta";
export function whatsappProvider(): WhatsAppProvider {
  if (process.env.WHATSAPP_PROVIDER === "meta")
    return new MetaWhatsAppProvider();
  if (process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_PROVIDER !== "mock")
    throw new Error("Unsupported WhatsApp provider");
  return new MockWhatsAppProvider();
}
