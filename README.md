# Tableline — restaurant queue & WhatsApp ordering

A functioning restaurant MVP built with Next.js 16.4 App Router, React 19.3,
TypeScript, Tailwind 4, Zod and PostgreSQL. Customers join a queue, order ahead,
review and pay. Staff call guests and manage orders. External integrations default
to mocks; **no Meta, Razorpay, Supabase or Docker account is needed locally**.

## Quick start

Use Node.js 22 LTS or newer compatible LTS and npm. On a normal clone:

```sh
npm ci
# Copy .env.example to .env.local (PowerShell: Copy-Item .env.example .env.local)
npm run db:setup
npm run dev
```

Open `http://localhost:3000/r/demo-restaurant`. Staff: `http://localhost:3000/admin`.
The development-only staff password is **dev-tableline** when `ADMIN_PASSWORD` is
unset. There is no password fallback in production. Stay on one hostname while
testing so browser cookies remain consistent.

The persistent local database automatically initializes on first request if you
skip `db:setup`. Keep `.data/` to preserve data across restarts. Do not run setup,
tests that open the same data folder, or multiple servers against a running PGlite
database. API/browser tests use the running server instead.

### This machine: full C: drive

Source is in `C:\Users\utdpr\OneDrive\Desktop\restaurant-queue-whatsapp`.
Because C: ran out of space, the tested runnable copy is
`A:\codex-tableline-runtime\app`, with dependencies in its parent directory.
The editable source remains in the original project. To copy source changes and run:

```powershell
.\scripts\sync-runtime.ps1
Set-Location A:\codex-tableline-runtime\app
npm run dev
```

Stop the existing server before syncing configuration or running a build. Do not
run `npm install` through the source's `node_modules` junction: npm replaces it.
For this machine, install in `A:\codex-tableline-runtime`, then copy its manifests
back to the source. A normal clone with sufficient disk space needs none of this.

## Features

- Restaurant link suitable for encoding in a printed QR code; responsive landing page.
- Validated name, Indian phone, party size and explicit WhatsApp consent.
- Daily per-restaurant Q001 numbering, duplicate protection and durable persistence.
- Customer status polls every 4 seconds. Estimate = waiting parties ahead × restaurant
  `average_service_minutes` (seed: 5). This is an estimate of **parties**, not diners.
- Staff waiting/called/seated/completed overview, phone, party, time and position.
- Call-next serializes on a restaurant row lock; simultaneous clicks within 3 seconds
  return the same called party. Individual actions lock the guest row.
- Waiting → called → seated → completed; waiting/called can cancel, called can return
  to waiting. Completed/cancelled visits cannot be reopened through these APIs.
- Public menu before joining, walk-in and reservation paths, signed reservation links,
  two reminders, confirmation expiry, and no-show handling.
- Floor plan, reservation-aware table suggestions, manual assignment, occupancy,
  cleaning and availability transitions with an audit trail.
- Menu category/item management, schedules, sold-out state, images and relational
  combos whose availability follows their component items.
- Persisted browser cart, quantities/removal, server-priced order snapshots and review.
- Mock payment success and failure/retry, paid receipts and live order status.
- Paid order lifecycle: confirmed → preparing → ready → completed.
- Four persisted WhatsApp notifications and a staff-only outbox/retry panel.
- Customer profiles, visit/order/payment history, feedback scores, favorites and
  deterministic returning, loyalty and service-recovery discounts.
- Secure staff accounts with six roles, server-enforced permissions, shifts,
  attendance and clock records. The development owner password remains for bootstrap.
- Payment analytics by date range, online/cash collection, manual discounts, partial
  or full refunds, immutable ledgers, VIP/deposit reporting and net-sales calculation.
- Attendance-based payroll generation, bonus/deduction adjustment, approval and paid
  states. Payroll records do not transfer money.
- Real Meta template and Razorpay payment/refund adapters, selected by environment variables.
- Signed private WhatsApp links work in another browser and expire after 7 days.

## Folder structure

```text
app/
  r/[slug]/                 Restaurant landing
  join/  queue/[id]/        Customer visit
  menu/[id]/  cart/[id]/    Menu and persistent cart
  checkout/[id]/            Mandatory order review
  payment/[id]/             Payment and live receipt
  visit/[id]/               Signed link → HttpOnly visit cookie
  admin/                    Operations, customers, staff, finance and payroll
  api/                      Validated customer/staff APIs and webhooks
components/
  queue/ menu/ cart/ admin/ ui/
lib/
  db/                       PGlite / pg query and transaction adapter
  queue/ orders/            Domain logic and parameterized SQL
  reservations/ tables/     Reservation lifecycle and floor allocation
  menu/ customers/          Menu scheduling, customer profiles and discounts
  staff/ payroll/           Accounts, role permissions, attendance and payroll
  whatsapp/                 Interface, mock, Meta, durable outbox
  payments/                 Interface, mock, Razorpay, HMAC, finalization
  validation/ utils/        Zod schemas, formatting and errors
  auth.ts visit-token.ts    Sessions, rate limits, scoped visit links
types/                      Shared application types
supabase/migrations/       PostgreSQL schema
supabase/seed.sql           Demo restaurant and 12 menu items
scripts/                    DB setup, API smoke test, optional Windows sync
tests/                      Unit and Playwright browser tests
docs/                       Architecture, integrations, verification
```

Architecture: pages/components → API validation/access checks → domain services →
transactional SQL. WhatsApp and payment adapters are selected on the server. Browser
components never import the database or provider credentials.

## PostgreSQL / Supabase setup

Local default: `DB_PROVIDER=pglite`, data in `.data/tableline`. PGlite is embedded
PostgreSQL, not a fake JSON database. `PGLITE_DATA_DIR` can change its location.

For Supabase or another PostgreSQL server:

1. Create a project/database. Obtain the **server PostgreSQL connection string**
   (direct connection or Supabase session pooler, usually port 5432).
2. Set `DB_PROVIDER=postgres`, `DATABASE_URL=...`, `DATABASE_SSL=true` in `.env.local`.
3. Run `npm run db:setup` with the app stopped. It applies every numbered migration
   in order and then the idempotent seed. If using the Supabase SQL editor, run all
   files in `supabase/migrations/` in filename order, followed by `supabase/seed.sql`.
4. Start the app. Remote mode never silently creates tables on an HTTP request.

Use the database owner/migration role for setup and a properly scoped server role
for deployment. Row level security is enabled with no anonymous policies; the
server database connection must have the required privileges/BYPASSRLS. Do not
connect the browser directly to these tables. Public Supabase URL/anon key and
service-role key variables are provided for compatibility but are **not used** by
this server SQL architecture. TLS certificate verification stays enabled; use
`DATABASE_SSL=false` only for a local PostgreSQL development server.

All prices are integer **paise**, with INR as the only currency. Foreign keys,
status/amount checks, partial active-visit uniqueness, indexes and daily counters
are in the migration. Order items retain names and prices at checkout. Menu data
can be updated using SQL; the repository/service separation supports later CRUD.

## Environment

See `.env.example` for the complete, credential-free template. `.env*` files are
ignored except `.env.example`.

| Variable                       | Purpose                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`          | Canonical origin for links and write-origin protection           |
| `DB_PROVIDER`                  | `pglite` (default) or `postgres`                                 |
| `DATABASE_URL`, `DATABASE_SSL` | Server PostgreSQL connection and verified TLS                    |
| `PGLITE_DATA_DIR`              | Persistent local PostgreSQL folder                               |
| `ADMIN_PASSWORD`               | Staff password; mandatory in production                          |
| `SESSION_SECRET`               | Random secret of at least 32 characters; mandatory in production |
| `TRUST_PROXY`                  | Only true behind a trusted proxy that overwrites forwarded IPs   |
| `WHATSAPP_PROVIDER`            | `mock` (default) or `meta`                                       |
| `PAYMENT_PROVIDER`             | `mock` (default) or `razorpay`                                   |

Generate your own session secret, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Local fallback values are development conveniences, not production credentials.

## Mock services

Mock WhatsApp writes the message to the server console and stores its provider ID
and status in `whatsapp_messages`. View `/admin/messages` to inspect it. No actual
message is delivered to a phone. Failed sends do not undo queue or payment commits;
staff can retry pending/failed rows, up to five attempts. Outbox delivery is
at-least-once, so a process crash between provider acceptance and database update
can cause a duplicate delivery on retry.

Mock payment has explicit success and failure buttons. It never contacts Razorpay
or collects card details. Failure does not confirm an order; retry can succeed.
Replays do not duplicate confirmation messages or downgrade a paid order. The mock
endpoint is rejected when real payments are enabled.

## Real integrations

See [docs/integrations.md](docs/integrations.md) for exact template parameters,
credentials, callback configuration and test-mode steps.

- **Meta:** `WHATSAPP_PROVIDER=meta`, access token, phone-number ID, supported Graph
  API version, template language and four approved template names. These are
  business-initiated template messages; joining a website queue is not an inbound
  WhatsApp conversation. No WhatsApp bot/conversational ordering is included.
- **Razorpay:** `PAYMENT_PROVIDER=razorpay`, server key ID/secret and webhook secret.
  Checkout receives only the public key ID. The server creates the order, verifies
  the HMAC and independently checks matching order/amount/INR/captured status.
  Configure automatic capture and signed `payment.captured` / `order.paid` webhooks.

No real provider call has been validated with merchant credentials in this build.
Use provider test accounts before enabling live charges or live notifications.

## Verification commands

```sh
npm run typecheck
npm run lint
npm test
npm run build
# With the app running in mock mode and no waiting customers:
npm run test:smoke
npm run test:e2e
```

Browser tests use installed Chrome by default. Set `PLAYWRIGHT_CHANNEL=msedge` for
Edge, or install Playwright Chromium and adapt the channel. `TEST_BASE_URL` selects
the running server; `TEST_ADMIN_PASSWORD` overrides the development test password.
Use a separate test database for repeatable automation. Tests create visits/orders
and complete them, leaving an intentional audit trail. See [verification notes](docs/verification.md).

## Deployment and remaining scope

- Deploy to a Node.js host with Supabase/PostgreSQL and HTTPS. Do not use local
  PGlite on ephemeral/serverless storage or multiple server processes.
- Set canonical app URL, a strong admin password and random session secret.
  Production cookies are Secure. The local dev server binds only to loopback;
  use an HTTPS deployment for phones scanning a printed restaurant link.
- Configure the first database-backed owner account and retire the bootstrap admin
  password after deployment. Add password reset/MFA before a broad staff rollout.
- Add monitoring, backups, retention/deletion policy and distributed rate limiting
  before public launch. The current database rate limiter is suitable for one app.
- The durable notification outbox needs a scheduled worker for unattended retries
  at production scale. This MVP sends after actions and offers staff retries.
- Tax invoicing, inventory quantities, customer OTP login and WhatsApp delivery/read
  receipts are outside this MVP. Cash collection and payroll are operational records,
  so restaurant controls and reconciliation remain necessary.
- Prices include all charges in the demo. Restaurant business/tax rules must be
  configured before live sales. Closed visits cannot place new orders.
- Draft orders can remain after cart edits; old drafts are not auto-expired. Capture
  verification/webhooks reconcile real successful payments even after a browser closes.
- Provider order creation can leave an orphan Razorpay order if the process crashes
  before recording it; add reconciliation before high-volume live operation.
- Local logs and debug messages contain customer data/private links. Restrict logs
  and do not share visit links. A signed link is a scoped access credential.
- Production dependency audit: zero findings at verification time. The upstream
  Next.js lint chain has five related dev-only `braces` findings with no patched
  release available; do not force-downgrade Next.js to npm audit's suggested older
  major. ESLint 9 and TypeScript 6 match the current Next.js lint peer requirements.

## Implementation phases

The original MVP and extension phases A–J are implemented. Phase K performs the
final regression, documentation and production-readiness review. See
`docs/extension-report.md` for the phase-by-phase inventory and remaining boundaries.
