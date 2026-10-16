# Restaurant operations extension

## Existing architecture (Phase A)

The existing Next.js App Router application separates customer and staff screens from JSON route handlers and transactional service modules. PostgreSQL is accessed through a small `Sql` interface; PGlite supplies the local PostgreSQL-compatible database. Queue numbers are allocated under a restaurant lock. Orders snapshot server-side menu prices. Payments require a recorded review and verified provider completion. WhatsApp uses a persistent outbox and interchangeable mock/Meta providers. Customer access uses private browser cookies and signed visit links; the existing staff guard uses a signed cookie.

Existing routes cover restaurant landing, join, queue, private menu, cart, review, payment, staff queue/orders/messages, and provider callbacks. Styling uses the existing brown/white palette and responsive reusable components. Existing data and migrations must be preserved.

Baseline: 14 tests, TypeScript, ESLint, production build and full guest/staff browser regression pass. A filesystem backup of the stopped local database was made before applying the extension.

## Incremental implementation

- A: inspect, document, baseline build and regression.
- B: additive migrations, settings, reservations, public menu and separate walk-in/reservation routes.
- C: configurable reminders, private confirmation links and expiry worker.
- D: centralized priority, reviewed VIP/deposit payments and bill credit.
- E: controlled table transitions and transactional allocation.
- F: menu/category management, combos and local-time schedules.
- G: customer history, feedback and deterministic discounts.
- H: staff accounts, backend permissions and attendance.
- I: cash, refunds and financial reporting.
- J: attendance-based payroll records and approval.
- K: regression, security review and operating documentation.

Each phase runs TypeScript, lint, tests and application checks before the next phase. Financial values remain integer paise. New business rules belong in services, not components. Provider credentials remain optional in mock mode. Migrations are additive and versioned; existing records are not recreated.

## Verified progress

- A: baseline build, 14 tests, lint/typecheck and full browser journey passed.
- B: additive reservation/settings schema, public menu and booking routes. 15 tests and both browser journeys passed on the production build.
- C: private YES/NO links, reminder/expiry processing and authenticated worker. Deterministic timing tests, both browser journeys, build, lint/typecheck and a real local worker cycle passed.
- D: priority accounting implementation in progress; service tests cover VIP discounts, ₹1,000/₹1,600 commitment accounting, low-value bills, review gates, failed-payment retries and idempotency.
