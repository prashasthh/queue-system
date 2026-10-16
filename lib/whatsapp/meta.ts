import { z } from "zod";
import type { WhatsAppPayload, WhatsAppProvider } from "./provider";
export class MetaWhatsAppProvider implements WhatsAppProvider {
  name = "meta" as const;
  async send(payload: WhatsAppPayload) {
    const token = process.env.META_WHATSAPP_TOKEN,
      phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const template =
      process.env[`META_TEMPLATE_${payload.message_type.toUpperCase()}`];
    const version = process.env.META_GRAPH_VERSION;
    if (
      !token ||
      !phoneId ||
      !template ||
      !version ||
      !/^v\d+\.\d+$/.test(version)
    )
      throw new Error(
        "Meta credentials, API version or approved template name missing",
      );
    const response = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: payload.phone.replace("+", ""),
          type: "template",
          template: {
            name: template,
            language: { code: process.env.META_TEMPLATE_LANGUAGE || "en" },
            components: [
              {
                type: "body",
                parameters: payload.template_parameters.map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      throw new Error(`Meta API returned HTTP ${response.status}`);
    const result = z
      .object({ messages: z.array(z.object({ id: z.string() })).min(1) })
      .parse(await response.json());
    return result.messages[0].id;
  }
}
