# Reservation reminders

Run `npm run worker` alongside the application. The worker polls the authenticated `/api/jobs/reservations` endpoint every 15 seconds, so PGlite is opened only by the application process. `npm run worker -- --once` runs one cycle. In production, use a supervised worker or a scheduler posting to the same endpoint with a `Bearer CRON_SECRET` header. Never expose this secret to browsers.

The worker defaults to a key derived from the shared SESSION_SECRET. Set CRON_SECRET explicitly when using an external scheduler. Reminder times and the arrival grace period are restaurant settings. Processing is transactional and repeatable: reminder timestamps and unique outbox event keys avoid duplicate enqueueing. Outbox delivery remains at-least-once.

Customers open a scoped, signed private link and press YES or NO. Opening a link alone does not change a reservation. Confirmation before the deadline keeps the booking active; cancellation releases capacity immediately. At the arrival deadline, unconfirmed bookings expire and confirmed bookings without recorded arrival become no-shows. Do not share private links. Meta templates use restaurant name, local reservation time, and the private link as three body parameters.

The worker must remain running for automatic reminders. A stopped worker catches up on its next cycle; already-expired bookings are expired without sending outdated reminders.
