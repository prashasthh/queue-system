import { createHmac } from "node:crypto";
import { sessionSecret } from "../lib/visit-token";
async function run() {
  const url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const secret =
    process.env.CRON_SECRET ||
    createHmac("sha256", sessionSecret())
      .update("reservation-worker")
      .digest("hex");
  let stopped = false;
  process.on("SIGINT", () => {
    stopped = true;
  });
  process.on("SIGTERM", () => {
    stopped = true;
  });
  console.log("Reservation worker started. Polling every 15 seconds.");
  while (!stopped) {
    try {
      const response = await fetch(`${url}/api/jobs/reservations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.reminders || result.expired) console.log(result);
    } catch (error) {
      console.error(
        "Reservation worker:",
        error instanceof Error ? error.message : "unavailable",
      );
    }
    if (process.argv.includes("--once")) break;
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
}
void run();
