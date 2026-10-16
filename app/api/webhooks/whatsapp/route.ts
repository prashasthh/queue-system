import { secureEqual } from "@/lib/auth";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.META_WHATSAPP_VERIFY_TOKEN;
  const challenge = url.searchParams.get("hub.challenge");
  if (
    token &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    secureEqual(url.searchParams.get("hub.verify_token") || "", token) &&
    challenge
  )
    return new Response(challenge);
  return new Response("Verification failed", { status: 403 });
}
