import { test, expect } from "@playwright/test";

test("owner can open staff, attendance, payments and payroll operations", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Staff password").fill(process.env.TEST_ADMIN_PASSWORD || "dev-tableline");
  await page.getByRole("button", { name: "Open dashboard" }).click();

  for (const [link, heading] of [
    ["Staff", "Staff accounts"],
    ["Attendance", "Attendance"],
    ["Payments", "Payments"],
    ["Payroll", "Payroll"],
  ] as const) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: /not allowed|failed|error/i })).toHaveCount(0);
  }
});
