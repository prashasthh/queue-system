import "server-only";
import { cookies } from "next/headers";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "./utils/errors";
import { getDb } from "./db";
import { sessionSecret, validVisitTicket } from "./visit-token";
import type { StaffRole } from "./staff/service";
import { can, type Permission } from "./staff/permissions";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const production = () => process.env.NODE_ENV === "production";
const secret = sessionSecret;
export function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (production())
    throw new AppError("ADMIN_PASSWORD must be configured", 503);
  return "dev-tableline";
}
export function secureEqual(a: string, b: string) {
  return timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
}
const options = () => ({
  httpOnly: true,
  secure: production(),
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
});
export async function customerToken(create = false) {
  const jar = await cookies();
  let token = jar.get("tableline_visit")?.value;
  if (!token && create) {
    token = randomBytes(32).toString("hex");
    jar.set("tableline_visit", token, options());
  }
  return token || "";
}
export async function requireVisit(id: string) {
  const token = await customerToken();
  const ticket = (await cookies()).get(`visit_${id}`)?.value;
  const [row] = await (
    await getDb()
  ).query<{ access_hash: string }>(
    "SELECT access_hash FROM queue_entries WHERE id=$1",
    [id],
  );
  if (
    !row ||
    !(
      (token && secureEqual(row.access_hash, hash(token))) ||
      (ticket && validVisitTicket(id, ticket))
    )
  )
    throw new AppError(
      "This visit belongs to another browser or has expired. Use your original device or private WhatsApp link.",
      403,
    );
}
export interface AdminSession { expires:number; staffId:string|null; restaurantId:string; name:string; role:StaffRole }
export async function setAdminSession(input?:Partial<Omit<AdminSession,"expires">>) {
  const session:AdminSession={expires:Date.now()+8*60*60*1000,staffId:input?.staffId??null,restaurantId:input?.restaurantId??"00000000-0000-4000-8000-000000000001",name:input?.name??"Demo owner",role:input?.role??"owner"};
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  (await cookies()).set("tableline_admin", `${payload}.${sig}`, {
    ...options(),
    maxAge: 8 * 60 * 60,
  });
}
export async function adminSession():Promise<AdminSession|null> {
  const value = (await cookies()).get("tableline_admin")?.value;
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if(!sig || !secureEqual(createHmac("sha256",secret()).update(payload).digest("hex"),sig)) return null;
  try { const session=JSON.parse(Buffer.from(payload,"base64url").toString()) as AdminSession; return session.expires>Date.now()&&["owner","manager","reception","waiter","kitchen","cashier"].includes(session.role)?session:null; } catch { return null; }
}
export async function isAdmin() { return !!(await adminSession()); }
export async function requireAdmin() {
  const session=await adminSession();
  if (!session) throw new AppError("Please sign in to the staff dashboard", 401);
  return session;
}
export async function requirePermission(permission:Permission){
  const session=await requireAdmin();
  if(!can(session.role,permission)) throw new AppError("Your staff role cannot perform this action",403);
  return session;
}
export async function logout() {
  (await cookies()).delete("tableline_admin");
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = [
    new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").origin,
  ];
  if (!production())
    allowed.push("http://127.0.0.1:3000", "http://localhost:3000");
  if (!origin || !allowed.includes(origin))
    throw new AppError("Request origin is not allowed", 403);
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const [row] = await (
    await getDb()
  ).query<{ hits: number }>(
    `INSERT INTO rate_limits(key,hits,expires_at) VALUES($1,1,now()+$2 * interval '1 second') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.hits+1 END, expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+$2 * interval '1 second' ELSE rate_limits.expires_at END RETURNING hits`,
    [hash(key), seconds],
  );
  if (row.hits > limit)
    throw new AppError(
      "Too many attempts. Please wait a few minutes and try again.",
      429,
    );
}
export function requestIp(request: Request) {
  return process.env.TRUST_PROXY === "true"
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
}
