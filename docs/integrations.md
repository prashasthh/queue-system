# Real provider setup

## Meta WhatsApp

Keep `WHATSAPP_PROVIDER=mock` until your Meta business setup and templates are ready.
Set `META_WHATSAPP_TOKEN` to a server-side token with WhatsApp messaging permissions,
`META_WHATSAPP_PHONE_NUMBER_ID` to the registered sender ID, and `META_GRAPH_VERSION`
to a version supported by your Meta app. Set `META_TEMPLATE_LANGUAGE` to the exact
approved template locale (for example `en` or `en_US`). Never use a public env prefix
for the token. Test with a permitted recipient in Meta's test environment first.

Create approved utility templates with **positional text body parameters** in these
orders. The adapter supplies one body component; do not add mandatory header/button
parameters without extending the adapter.

| Environment name                   | Body parameters in order                           |
| ---------------------------------- | -------------------------------------------------- |
| `META_TEMPLATE_QUEUE_JOINED`       | restaurant name, queue number, parties ahead       |
| `META_TEMPLATE_CUSTOMER_CALLED`    | queue number, private visit/menu URL               |
| `META_TEMPLATE_ORDER_CONFIRMED`    | short order ID, one-line item summary              |
| `META_TEMPLATE_PAYMENT_SUCCESSFUL` | formatted INR amount, short order ID, queue number |

The called template should include the URL in its body. Opening it grants that
visit access for up to seven days. Treat it as private. The consent checkbox is
required and `consent_at` is stored with each visit.

Optional GET verification endpoint: `/api/webhooks/whatsapp`, using
`META_WHATSAPP_VERIFY_TOKEN`. Delivery/read receipts and inbound conversational
messages are not implemented; the message desk's `sent` means **accepted by the
provider**, not delivered or read. Do not subscribe unsupported inbound events.

Provider requests time out and record a failed message without reverting the core
transaction. Fix configuration, then use **Retry pending messages**. After five
attempts, staff/developers must investigate before deliberately resetting attempts.
Do not switch an old mock demo database with pending messages into live mode.

Official references: [Meta template object](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/TemplateObject/)
and [Meta Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

## Razorpay

1. Create merchant test API keys. Set `PAYMENT_PROVIDER=razorpay`,
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. The optional public key variable in the
   example is not needed: `/api/payments/[id]` exposes the server key ID only.
2. Enable automatic payment capture in the Razorpay dashboard.
3. Configure an HTTPS webhook to `/api/webhooks/razorpay`, subscribe to
   `payment.captured` and `order.paid`, and set the matching `RAZORPAY_WEBHOOK_SECRET`.
4. Complete a test checkout, inspect the database, replay the webhook, and verify
   the paid state and notifications are not duplicated. Test closing the browser
   after paying; the webhook should still finalize the order.
5. Switch to live keys only after merchant onboarding and deployment verification.

The adapter sends integer paise, INR and an internal receipt ID to the server Orders
API. The browser amount is display-only. Signature verification uses the **stored**
provider order ID and HMAC SHA-256. A second server API request checks payment ID,
order ID, amount, currency and `captured` status before the database is marked paid.
An `authorized` result remains pending; the webhook can confirm it after capture.

Webhooks validate the raw-body HMAC using their separate secret, resolve the stored
order and perform the same captured-payment lookup. Duplicate events are harmless.
Unknown provider orders return a retryable error, accommodating a webhook racing
the order record commit. Unrelated event types are acknowledged and ignored.

Failed checkout attempts are shown to the customer and can be retried. Real failed
attempt history is not persisted; only captured payments finalize through the API.
Mock failures are persisted so both UI paths are testable without credentials.
Staff with payment permission can issue partial or full refunds. Mock and cash refunds
are recorded locally; Razorpay refunds call `POST /v1/payments/:id/refund` with the
server-stored captured payment ID and integer-paise amount before recording the refund.
Refunds are immutable records and never delete the original payment.

Official reference: [Razorpay Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).
Refund reference: [Razorpay Refund API](https://razorpay.com/docs/api/refunds/).
