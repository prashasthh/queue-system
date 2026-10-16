# Verification record

Verified locally on 10 October 2026, using Node.js 22.21, Next.js 16.4,
PostgreSQL through PGlite, and installed Chrome on Windows.

## Automated coverage

- PostgreSQL schema migration and seed executed successfully; 12 menu items loaded.
- A real localhost HTTP request returned 200 after fixing installation/startup issues.
- API smoke test passed before Meta/Razorpay adapters were added: join, human-readable
  queue number, duplicate join, customer access isolation, staff protection/login,
  concurrent call-next, customer status, menu, price-tampering rejection, order
  idempotency, mandatory review, failed payment, successful retry, paid-state replay
  protection, four persisted mock messages, order progression and completed visit.
- Chrome browser test passed against a production build at 390×844 customer and
  1440×1000 staff viewports. It exercises landing → join → staff call → menu →
  quantity changes → cart reload/persistence → review → failed payment → successful
  payment → staff preparing/ready/completed → WhatsApp private link in a fresh browser
  → seated/completed visit. It checks no browser runtime/hydration errors and no
  horizontal overflow on the receipt screen.
- Unit tests cover Indian phone normalization, invalid/injected order input, HMAC
  binding/tampering, visit expiry/scope, and Razorpay API-response mismatches.
- Database tests use a separate in-memory PostgreSQL instance for concurrent queue
  allocation/call-next, invalid transitions, menu availability, transactional pricing,
  payment replay, WhatsApp failure isolation and closed-visit payment rejection.
- The current service suite contains 22 passing tests. Added coverage includes
  reservation capacity/reminders, priority payments, table allocation, scheduled
  menus/combos, customer feedback discounts, staff authentication/permissions,
  attendance, cash collection, refund/net-sales accounting and payroll transitions.
- Four current Playwright journeys pass against the production build: the complete
  dining journey, public/reservation flow, VIP review/payment and scheduled menu/admin.

Run commands and prerequisites are in the README. Test data remains as an audit trail
in the local demo database; no real messages or money were sent.

## Visual inspection

Mobile landing, mobile order review and desktop staff queue screenshots were opened
and inspected. Typography, spacing, action visibility and table layout are readable.
Playwright generates screenshots under `test-results/` on every full journey run.

## Important boundaries

Real Meta delivery, merchant Razorpay test/live payments, remote Supabase connectivity,
multiple PostgreSQL app instances and public HTTPS deployment were not tested because
credentials/infrastructure were not supplied. Razorpay verification is additionally
unit-tested using stubbed HTTP responses, which is not a merchant integration test.

Production `npm audit --omit=dev` returned zero findings. Full audit reports five
related dev-only findings caused by `braces <=3.0.3` in Next.js's lint chain. Registry
latest was 3.0.3, with no patched release. ESLint 9 emits an upstream support warning;
ESLint 10/TypeScript 7 do not satisfy this Next.js lint plugin dependency set. Track
the upstream fix instead of applying npm's proposed old-major Next.js downgrade.

## Environment issues resolved

- C: was full; dependencies and runnable copy moved to the approved A: runtime folder.
- Cross-drive Next.js dependency resolution failed; running the entire app copy on A:
  resolved it. Partial dependency downloads were replaced with a clean installation.
- Embedded PostgreSQL initialization initially failed under memory pressure while the
  compiler was running. Stopping compilation allowed initialization to complete.
- Production build uses one worker and webpack memory optimizations.
- A transient typecheck ran during a dev-server restart and saw missing generated type
  files. Production build regenerated and successfully checked route types.
- Browser test selectors were narrowed to avoid Next.js's hidden route announcer;
  private-link extraction uses the authenticated browser DOM because the HTTP test
  client treats Secure cookies differently on local HTTP.
