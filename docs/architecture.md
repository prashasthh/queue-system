# Architecture and invariants

- Next.js App Router renders responsive customer and staff screens.
- All writes use same-origin JSON endpoints validated by Zod.
- Domain services own queue transitions, server-side pricing and payment finalization.
- SQL uses bound parameters; monetary values are integer paise, INR only.
- A database adapter exposes query/transaction with pg or PGlite.
- Local PGlite is real embedded PostgreSQL, persisted to `.data/tableline`.
- Supabase uses a server-side PostgreSQL connection; no browser database credentials are necessary.
- Daily restaurant counters and row locks serialize queue allocation and call-next.
- A short call-next debounce prevents accidental concurrent staff clicks from calling multiple parties.
- Customer visit tokens are HttpOnly cookies; a queue UUID alone grants no access.
- Admin sessions are signed, expiring cookies; production requires configured secrets.
- Notification rows form a durable outbox. Sending failures do not roll back queue/payment writes.
- Orders snapshot names and prices; payment amounts always come from database totals.
- Payment finalization is transactional and idempotent, including repeated callbacks.

## Local storage on this machine

C: lacked space during installation. With permission, the runnable source copy
is `A:\codex-tableline-runtime\app`, with dependencies in its parent directory.
The original folder remains the editable source. Use `scripts/sync-runtime.ps1`
while the server is stopped to copy edits into the runnable folder.
This is a machine-specific development arrangement,
not a requirement for a normal clone. Install dependencies normally on a machine with
sufficient space. Do not run two Next.js processes against the same PGlite data folder.
