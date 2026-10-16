import { test, expect } from "@playwright/test";

test("scheduled menu and menu manager expose the seeded combo", async ({ page }) => {
  await page.goto("/r/demo-restaurant/menu");
  const combo = page.getByRole("article").filter({ hasText: "Biryani Combo" });
  await expect(combo).toContainText("₹379");
  await expect(combo).toContainText("Chicken Biryani");

  await page.goto("/admin");
  await page
    .getByLabel("Staff password")
    .fill(process.env.TEST_ADMIN_PASSWORD || "dev-tableline");
  await page.getByRole("button", { name: "Open dashboard" }).click();
  await page.getByRole("link", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Menu manager" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Biryani Combo" })).toBeVisible();
  await expect(page.getByText("Chicken Biryani").last()).toBeVisible();
});
