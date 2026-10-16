import { createHmac, timingSafeEqual } from "node:crypto";
export function validHmac(payload: string, signature: string, secret: string) {
  if (!secret || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
