import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { phone, orderSchema } from "../lib/validation";
import { validHmac } from "../lib/payments/signature";
import { visitTicket, validVisitTicket } from "../lib/visit-token";
import { RazorpayPaymentProvider } from "../lib/payments/razorpay";
test("Indian phones normalize; malformed and overseas numbers fail", () => {
  for (const value of ["9876543210", "91 98765 43210", "+91 (98765) 43210"])
    assert.equal(phone.parse(value), "+919876543210");
  for (const value of ["123", "+14155552671", "5876543210"])
    assert.equal(phone.safeParse(value).success, false);
});
test("orders reject injected prices and duplicate menu IDs", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const input = {
    queueEntryId: id,
    requestId: id,
    items: [{ menuItemId: id, quantity: 2 }],
  };
  assert(orderSchema.safeParse(input).success);
  assert(!orderSchema.safeParse({ ...input, total: 1 }).success);
  assert(
    !orderSchema.safeParse({
      ...input,
      items: [...input.items, ...input.items],
    }).success,
  );
  assert(
    !orderSchema.safeParse({
      ...input,
      items: [{ menuItemId: id, quantity: -1 }],
    }).success,
  );
});
test("HMAC signatures bind payment and server order; malformed signatures fail", () => {
  const secret = "test-only-secret";
  const payload = "order_a|pay_b";
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  assert(validHmac(payload, sig, secret));
  assert(!validHmac("order_changed|pay_b", sig, secret));
  assert(!validHmac(payload, "00", secret));
  assert(!validHmac(payload, sig, ""));
});
test("visit tickets are scoped, signed and expiring", () => {
  const ticket = visitTicket("visit-a");
  assert(validVisitTicket("visit-a", ticket));
  assert(!validVisitTicket("visit-b", ticket));
  assert(!validVisitTicket("visit-a", visitTicket("visit-a", Date.now() - 1)));
  assert(!validVisitTicket("visit-a", ticket + "tampered"));
});
test("Razorpay capture verification rejects wrong amount, order, currency and authorization-only state", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.RAZORPAY_KEY_ID,
    oldSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "test";
  process.env.RAZORPAY_KEY_SECRET = "test";
  try {
    const provider = new RazorpayPaymentProvider();
    const valid = {
      id: "pay_1",
      order_id: "order_1",
      amount: 24000,
      currency: "INR",
      status: "captured",
    };
    for (const change of [
      { amount: 1 },
      { order_id: "wrong" },
      { currency: "USD" },
      { status: "authorized" },
    ]) {
      globalThis.fetch = async () => Response.json({ ...valid, ...change });
      await assert.rejects(() =>
        provider.capturedPayment("pay_1", "order_1", 24000),
      );
    }
    globalThis.fetch = async () => Response.json(valid);
    assert.equal(
      (await provider.capturedPayment("pay_1", "order_1", 24000)).id,
      "pay_1",
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = oldKey;
    if (oldSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = oldSecret;
  }
});
test("Razorpay refunds use the captured payment ID and server amount", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.RAZORPAY_KEY_ID,
    oldSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "test";
  process.env.RAZORPAY_KEY_SECRET = "test";
  try {
    let request: { url: string; body: string } | undefined;
    globalThis.fetch = async (input, init) => {
      request = { url: String(input), body: String(init?.body) };
      return Response.json({
        id: "rfnd_1",
        payment_id: "pay_1",
        amount: 5000,
        currency: "INR",
      });
    };
    const result = await new RazorpayPaymentProvider().refund(
      "pay_1",
      5000,
      "Guest request",
    );
    assert.equal(result.id, "rfnd_1");
    assert.match(request!.url, /payments\/pay_1\/refund$/);
    assert.deepEqual(JSON.parse(request!.body), {
      amount: 5000,
      notes: { reason: "Guest request" },
    });
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = oldKey;
    if (oldSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = oldSecret;
  }
});
