import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
function client() {
  let cookie = "";
  return async (path, method = "GET", data) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: base,
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    const set = response.headers.getSetCookie();
    if (set.length) cookie = set.map((s) => s.split(";")[0]).join("; ");
    return { status: response.status, body: await response.json() };
  };
}
const guest = client(),
  staff = client(),
  stranger = client();
const phone = `9${String(Date.now()).slice(-9)}`;
const join = {
  name: "MVP Test Guest",
  phone,
  partySize: 3,
  slug: "demo-restaurant",
  requestId: randomUUID(),
  consent: true,
};
const joined = await guest("/api/queue", "POST", join);
assert.equal(joined.status, 200, JSON.stringify(joined));
const q = joined.body;
assert.match(q.queue_number, /^Q\d{3,}$/);
console.log("PASS join and queue number", q.queue_number);
assert.equal((await guest("/api/queue", "POST", join)).body.id, q.id);
assert.equal((await stranger(`/api/queue/${q.id}`)).status, 403);
assert.equal((await stranger("/api/admin/queue")).status, 401);
console.log("PASS duplicate join, visit isolation and admin protection");
assert.equal(
  (
    await staff("/api/admin/login", "POST", {
      password: process.env.TEST_ADMIN_PASSWORD || "dev-tableline",
    })
  ).status,
  200,
);
let queue = (await staff("/api/admin/queue")).body;
assert(queue.some((e) => e.id === q.id));
const calls = await Promise.all([
  staff("/api/admin/queue", "POST", {}),
  staff("/api/admin/queue", "POST", {}),
]);
assert.equal(calls[0].status, 200);
assert.equal(calls[0].body.id, calls[1].body.id);
assert.equal(
  calls[0].body.id,
  q.id,
  "Run this test against an empty waiting queue",
);
assert.equal((await guest(`/api/queue/${q.id}`)).body.status, "called");
console.log("PASS admin sees guest, atomic call-next, customer status");
const menu = (await guest(`/api/menu/${q.id}`)).body;
assert.equal(menu.length, 12);
const fries = menu.find((m) => m.name === "French Fries");
const input = {
  queueEntryId: q.id,
  requestId: randomUUID(),
  items: [{ menuItemId: fries.id, quantity: 2 }],
};
assert.equal(
  (await guest("/api/orders", "POST", { ...input, total: 1 })).status,
  400,
);
const created = await guest("/api/orders", "POST", input);
assert.equal(created.status, 200, JSON.stringify(created));
const o = created.body;
assert.equal(o.total, 24000);
assert.equal((await guest("/api/orders", "POST", input)).body.id, o.id);
console.log(
  "PASS menu, server pricing, tamper rejection and order idempotency",
);
assert.equal(
  (await guest(`/api/payments/${o.id}/mock`, "POST", { result: "success" }))
    .status,
  409,
);
assert.equal(
  (await guest(`/api/orders/${o.id}/review`, "POST", {})).status,
  200,
);
assert.equal(
  (await guest(`/api/payments/${o.id}/mock`, "POST", { result: "failed" })).body
    .payment_status,
  "failed",
);
const paid = await guest(`/api/payments/${o.id}/mock`, "POST", {
  result: "success",
});
assert.equal(paid.body.payment_status, "paid", JSON.stringify(paid));
assert.equal(paid.body.status, "confirmed");
await guest(`/api/payments/${o.id}/mock`, "POST", { result: "success" });
assert.equal(
  (await guest(`/api/payments/${o.id}/mock`, "POST", { result: "failed" })).body
    .payment_status,
  "paid",
);
console.log(
  "PASS review gate, failed payment, retry, paid confirmation and replay protection",
);
const messages = (await staff("/api/admin/messages")).body.filter(
  (m) =>
    m.message.includes(q.queue_number) ||
    m.message.includes(o.id.slice(0, 8).toUpperCase()),
);
assert.equal(messages.length, 4);
assert(messages.every((m) => m.status === "sent" && m.provider === "mock"));
console.log("PASS four persisted mock WhatsApp notifications");
const orders = (await staff("/api/admin/orders")).body;
assert(orders.some((v) => v.id === o.id && v.payment_status === "paid"));
assert.equal(
  (await staff(`/api/admin/orders/${o.id}`, "PATCH", { status: "completed" }))
    .status,
  409,
);
for (const status of ["preparing", "ready", "completed"])
  assert.equal(
    (await staff(`/api/admin/orders/${o.id}`, "PATCH", { status })).body.status,
    status,
  );
for (const status of ["seated", "completed"])
  assert.equal(
    (await staff(`/api/admin/queue/${q.id}`, "PATCH", { status })).body.status,
    status,
  );
console.log("PASS admin order lifecycle and visit completion");
console.log("ALL MOCK API SMOKE CHECKS PASSED");
