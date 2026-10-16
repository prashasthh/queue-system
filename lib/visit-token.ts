import { createHmac } from "node:crypto";
import { validHmac } from "./payments/signature";
export function sessionSecret() {
  const key = process.env.SESSION_SECRET;
  if (key && key.length >= 32) return key;
  if (process.env.NODE_ENV === "production")
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  return "local-development-session-secret-do-not-deploy";
}
export function visitTicket(
  id: string,
  expires = Date.now() + 7 * 24 * 60 * 60 * 1000,
) {
  const payload = `${id}.${expires}`;
  return `${expires}.${createHmac("sha256", sessionSecret()).update(payload).digest("hex")}`;
}
export function validVisitTicket(id: string, ticket: string) {
  const [expires, signature] = ticket.split(".");
  return (
    !!signature &&
    Number(expires) > Date.now() &&
    validHmac(`${id}.${expires}`, signature, sessionSecret())
  );
}
