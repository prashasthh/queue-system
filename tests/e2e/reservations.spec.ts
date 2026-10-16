import { test, expect } from "@playwright/test";
test("public menu and reservation booking work without a queue entry", async ({
  page,
}) => {
  await page.goto("/r/demo-restaurant/menu");
  await expect(
    page.getByRole("heading", { name: "French Fries", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reservation", exact: true }).click();
  await page.getByLabel("Your name").fill("Reservation Browser Guest");
  await page
    .getByLabel("WhatsApp number")
    .fill(`8${String(Date.now()).slice(-9)}`);
  await page.getByLabel("Party size").fill("3");
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Date", { exact: true }).fill(tomorrow);
  await page.getByLabel("Time (IST)").fill("13:00");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Book reservation" }).click();
  await expect(page).toHaveURL(/\/reservation\//);
  await expect(
    page.getByRole("heading", { name: "Your reservation" }),
  ).toBeVisible();
  await expect(page.getByText("pending", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "YES, I’m coming" }).click();
  await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "NO, cancel reservation" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
});
