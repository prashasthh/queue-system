import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db";
import { joinQueue } from "../lib/queue/service";
import { createOrder } from "../lib/orders/service";
import {
  adminMenu,
  publicMenu,
  saveItem,
  saveSchedule,
  scheduleIsActive,
} from "../lib/menu/service";

test("menu combos, sold-out validation and IST schedules are server enforced", async () => {
  process.env.DB_PROVIDER = "pglite";
  process.env.PGLITE_DATA_DIR = "memory://";
  const db = await getDb();
  const restaurantId = "00000000-0000-4000-8000-000000000001";
  try {
    assert.equal(
      scheduleIsActive(
        { start_time: "22:00", end_time: "02:00", days: [1] },
        2,
        60,
      ),
      true,
    );
    assert.equal(
      scheduleIsActive(
        { start_time: "22:00", end_time: "02:00", days: [1] },
        2,
        180,
      ),
      false,
    );
    const firstMenu = await publicMenu("demo-restaurant"),
      combo = firstMenu.find((item) => item.name === "Biryani Combo")!;
    assert.equal(combo.price, 37900);
    assert.equal(combo.original_price, 43000);
    assert.equal(combo.components?.length, 3);

    const visit = await joinQueue(
      {
        name: "Menu Guest",
        phone: "+919844444444",
        partySize: 2,
        slug: "demo-restaurant",
        requestId: randomUUID(),
        consent: true,
      },
      "menu-test",
    );
    assert.equal(
      (
        await createOrder({
          queueEntryId: visit.id,
          requestId: randomUUID(),
          items: [{ menuItemId: combo.id, quantity: 1 }],
        })
      ).subtotal,
      37900,
    );
    const [coke] = await db.query<{ id: string }>(
      "SELECT id FROM menu_items WHERE name='Coke'",
    );
    await db.query("UPDATE menu_items SET sold_out=true WHERE id=$1", [
      coke.id,
    ]);
    assert.equal(
      (await publicMenu("demo-restaurant")).find((item) => item.id === combo.id)
        ?.available,
      false,
    );
    await assert.rejects(
      createOrder({
        queueEntryId: visit.id,
        requestId: randomUUID(),
        items: [{ menuItemId: combo.id, quantity: 1 }],
      }),
      /no longer available/,
    );
    await db.query("UPDATE menu_items SET sold_out=false WHERE id=$1", [
      coke.id,
    ]);

    const managed = await adminMenu(restaurantId),
      category = managed.categories.find((value) => value.name === "Starters")!;
    const snack = await saveItem(restaurantId, {
      categoryId: category.id,
      name: "Late Snack",
      description: "Available on the overnight menu.",
      price: 9900,
      imageUrl: "",
      vegetarian: true,
      available: true,
      soldOut: false,
      active: true,
      itemType: "item",
      components: [],
    });
    await saveSchedule(restaurantId, {
      name: "Late night",
      startTime: "22:00",
      endTime: "02:00",
      days: [1],
      categoryIds: [],
      itemIds: [snack.id],
      active: true,
    });
    const mondayLate = await publicMenu(
      "demo-restaurant",
      new Date("2026-10-12T17:30:00.000Z"),
    );
    assert.deepEqual(
      mondayLate.map((item) => item.name),
      ["Late Snack"],
    );
    const tuesdayAfterMidnight = await publicMenu(
      "demo-restaurant",
      new Date("2026-10-12T19:30:00.000Z"),
    );
    assert.deepEqual(
      tuesdayAfterMidnight.map((item) => item.name),
      ["Late Snack"],
    );
    assert.equal(
      (
        await publicMenu(
          "demo-restaurant",
          new Date("2026-10-12T22:00:00.000Z"),
        )
      ).length,
      0,
    );
  } finally {
    await db.close();
  }
});
