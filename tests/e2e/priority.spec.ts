import { test, expect } from "@playwright/test";
test("VIP fee has a review gate and activates after mock payment", async ({
  page,
}) => {
  await page.goto("/r/demo-restaurant/walk-in");
  await page.getByLabel("Your name").fill("VIP Browser Guest");
  await page
    .getByLabel("WhatsApp number")
    .fill(`7${String(Date.now()).slice(-9)}`);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: "Get my queue number" }).click();
  await expect(page).toHaveURL(/priority\/queue/);
  const visitId = page.url().split("/").pop();
  await page.getByRole("button", { name: "Review vip", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review your priority" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simulate successful payment" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Confirm review and continue to payment" })
    .click();
  await page
    .getByRole("button", { name: "Simulate successful payment" })
    .click();
  await expect(page.getByText("paid", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to your visit" }).click();
  await expect(page.getByText(/vip fast-track active/i)).toBeVisible();
  await expect(page.getByText("called", { exact: true })).toBeVisible();
  // Close only this synthetic test visit so later FIFO regression runs remain isolated.
  const base = process.env.TEST_BASE_URL || "http://localhost:3000";
  await page.request.post("/api/admin/login", {
    headers: { Origin: base },
    data: { password: process.env.TEST_ADMIN_PASSWORD || "dev-tableline" },
  });
  const cleanup = await page.request.patch(`/api/admin/queue/${visitId}`, {
    headers: { Origin: base },
    data: { status: "cancelled" },
  });
  expect(cleanup.ok()).toBeTruthy();
});
