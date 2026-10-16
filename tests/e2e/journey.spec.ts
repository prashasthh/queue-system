import { test, expect } from "@playwright/test";
test("mobile guest and desktop staff complete the dining journey", async ({
  browser,
}) => {
  const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";
  const guestContext = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
    }),
    staffContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
    });
  const page = await guestContext.newPage(),
    staff = await staffContext.newPage();
  const errors: string[] = [];
  for (const p of [page, staff]) {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error" && /hydration|hydrated|mismatch/i.test(m.text()))
        errors.push(m.text());
    });
  }
  const name = "Browser Test Guest",
    phone = `9${String(Date.now()).slice(-9)}`;
  await page.goto("/r/demo-restaurant");
  await expect(page.getByRole("heading", { name: /Good food/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: /Join the queue/ }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("WhatsApp number").fill(phone);
  await page.getByLabel("How many in your party?").selectOption("4");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Get my queue number" }).click();
  await expect(page).toHaveURL(/\/queue\//);
  await expect(
    page.getByRole("heading", { name: "You’re in the queue!" }),
  ).toBeVisible();
  const visitId = page.url().split("/").pop()!;
  await staff.goto("/admin");
  await staff
    .getByLabel("Staff password")
    .fill(process.env.TEST_ADMIN_PASSWORD || "dev-tableline");
  await staff.getByRole("button", { name: "Open dashboard" }).click();
  await expect(
    staff.getByRole("heading", { name: "Your guest list" }),
  ).toBeVisible();
  const guestRow = staff.getByRole("row").filter({ hasText: phone });
  await expect(guestRow).toBeVisible();
  await staff.getByRole("button", { name: "Call next customer" }).click();
  await expect(
    page.getByRole("heading", { name: "Your turn is coming!" }),
  ).toBeVisible();
  await staff.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Explore the menu" }).click();
  await expect(
    page.getByRole("heading", { name: "What sounds good?" }),
  ).toBeVisible();
  const fries = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "French Fries", exact: true }),
  });
  await fries.getByRole("button", { name: "Add", exact: true }).click();
  await fries.getByRole("button", { name: "Add one French Fries" }).click();
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page).toHaveURL(/\/cart\//);
  await expect(page.getByText("₹240", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("₹240", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review order" }).click();
  await expect(
    page.getByRole("heading", { name: "Everything look delicious?" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/review-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Proceed to payment/ }).click();
  await page.getByRole("button", { name: "Simulate failed payment" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "No money was charged" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simulate successful payment" })
    .click();
  await expect(
    page.getByRole("heading", { name: "You’re all set." }),
  ).toBeVisible();
  const orderId = page.url().split("/").pop()!;
  await page.screenshot({
    path: "test-results/payment-mobile.png",
    fullPage: true,
  });
  await staff.getByRole("link", { name: "Orders", exact: true }).click();
  const card = staff
    .getByRole("article")
    .filter({ hasText: orderId.slice(0, 8).toUpperCase() });
  await expect(card).toContainText("paid");
  await card.getByRole("button", { name: "Start preparing" }).click();
  await card.getByRole("button", { name: "Mark ready" }).click();
  await card.getByRole("button", { name: "Complete order" }).click();
  await expect(card).toContainText("completed");
  await expect(page.getByText("completed", { exact: true })).toBeVisible();
  await staff.getByRole("link", { name: "Messages", exact: true }).click();
  await expect(staff.getByText(/Payment received/).first()).toBeVisible();
  const called = staff
    .getByRole("article")
    .filter({ hasText: `/visit/${visitId}` });
  await expect(called).toBeVisible();
  const message = await called.innerText();
  const link = message
    .match(/https?:\/\/\S+/)![0]
    .replace("http://localhost:3000", baseURL);
  const resumed = await browser.newContext({ baseURL });
  const resumePage = await resumed.newPage();
  await resumePage.goto(link);
  await expect(
    resumePage.getByRole("heading", { name: "What sounds good?" }),
  ).toBeVisible();
  await resumed.close();
  await staff.getByRole("link", { name: "Queue", exact: true }).click();
  await guestRow.getByRole("button", { name: "Seat", exact: true }).click();
  await guestRow.getByRole("button", { name: "Complete", exact: true }).click();
  await staff.getByRole("link", { name: "Messages", exact: true }).click();
  const feedbackMessage = staff
    .getByRole("article")
    .filter({ hasText: `/feedback/${visitId}` });
  await expect(feedbackMessage).toBeVisible();
  const feedbackLink = (await feedbackMessage.innerText())
    .match(/https?:\/\/\S+/)![0]
    .replace("http://localhost:3000", baseURL);
  await page.goto(feedbackLink);
  await page.getByLabel("Comment (optional)").fill("A smooth browser test visit.");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("heading", { name: /Thank you/ })).toBeVisible();
  const floorResponse = await staff.request.get("/api/admin/floor"),
    tables = (await floorResponse.json()) as Array<{ id: string; status: string }>;
  for (const table of tables.filter((value) => value.status === "cleaning"))
    await staff.request.post("/api/admin/floor", {
      headers: { Origin: baseURL },
      data: { action: "status", id: table.id, status: "available" },
    });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await guestContext.close();
  await staffContext.close();
});
