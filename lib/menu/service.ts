import { z } from "zod";
import { getDb, type Sql } from "../db";
import { AppError } from "../utils/errors";
import { audit } from "../audit";
import type { MenuItem } from "@/types";

const timeValue = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/);
export const categoryInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(80),
    sortOrder: z.number().int().min(0).max(1000),
    active: z.boolean(),
  })
  .strict();
export const itemInput = z
  .object({
    id: z.string().uuid().optional(),
    categoryId: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000),
    price: z.number().int().min(1).max(10000000),
    imageUrl: z.union([
      z.string().url().max(1000),
      z.string().regex(/^\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp)$/),
      z.literal(""),
    ]),
    vegetarian: z.boolean(),
    available: z.boolean(),
    soldOut: z.boolean(),
    active: z.boolean(),
    itemType: z.enum(["item", "combo"]),
    components: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.itemType === "combo" && value.components.length < 2)
      context.addIssue({
        code: "custom",
        message: "A combo needs at least two components",
      });
    if (value.itemType === "item" && value.components.length)
      context.addIssue({
        code: "custom",
        message: "Regular items cannot have combo components",
      });
    if (
      new Set(value.components.map((item) => item.itemId)).size !==
      value.components.length
    )
      context.addIssue({
        code: "custom",
        message: "Combo components must be unique",
      });
  });
export const scheduleInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(80),
    startTime: timeValue,
    endTime: timeValue,
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    categoryIds: z.array(z.string().uuid()).max(50),
    itemIds: z.array(z.string().uuid()).max(200),
    active: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startTime === value.endTime)
      context.addIssue({
        code: "custom",
        message: "Schedule start and end must differ",
      });
    if (new Set(value.days).size !== value.days.length)
      context.addIssue({
        code: "custom",
        message: "Schedule days must be unique",
      });
    if (!value.categoryIds.length && !value.itemIds.length)
      context.addIssue({
        code: "custom",
        message: "Choose at least one category or item",
      });
  });

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}
export interface MenuSchedule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days: number[];
  active: boolean;
  category_ids: string[];
  item_ids: string[];
}
export interface ManagedMenu {
  categories: MenuCategory[];
  items: MenuItem[];
  schedules: MenuSchedule[];
}

function clock(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
function localClock(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      value.weekday,
    ),
    minute: Number(value.hour) * 60 + Number(value.minute),
  };
}
export function scheduleIsActive(
  schedule: Pick<MenuSchedule, "start_time" | "end_time" | "days">,
  day: number,
  minute: number,
) {
  const start = clock(schedule.start_time),
    end = clock(schedule.end_time);
  if (start < end)
    return schedule.days.includes(day) && minute >= start && minute < end;
  if (minute >= start) return schedule.days.includes(day);
  return minute < end && schedule.days.includes((day + 6) % 7);
}

async function schedules(restaurantId: string, sql: Sql) {
  const rows = await sql.query<
    MenuSchedule & { category_id: string | null; item_id: string | null }
  >(
    `SELECT s.*,sc.category_id,si.menu_item_id AS item_id FROM menu_schedules s LEFT JOIN menu_schedule_categories sc ON sc.schedule_id=s.id LEFT JOIN menu_schedule_items si ON si.schedule_id=s.id WHERE s.restaurant_id=$1 ORDER BY s.name`,
    [restaurantId],
  );
  const result = new Map<string, MenuSchedule>();
  for (const row of rows) {
    const current = result.get(row.id) || {
      ...row,
      category_ids: [],
      item_ids: [],
    };
    if (row.category_id && !current.category_ids.includes(row.category_id))
      current.category_ids.push(row.category_id);
    if (row.item_id && !current.item_ids.includes(row.item_id))
      current.item_ids.push(row.item_id);
    result.set(row.id, current);
  }
  return [...result.values()];
}

export async function menuForRestaurantId(
  restaurantId: string,
  sql?: Sql,
  now = new Date(),
) {
  const db = sql || (await getDb());
  const [restaurant] = await db.query<{ timezone: string }>(
    "SELECT timezone FROM restaurants WHERE id=$1 AND active=true",
    [restaurantId],
  );
  if (!restaurant) throw new AppError("Restaurant not found", 404);
  const items = await db.query<MenuItem>(
    `SELECT m.*,c.name AS category,c.sort_order FROM menu_items m JOIN menu_categories c ON c.id=m.category_id WHERE m.restaurant_id=$1 AND m.active AND c.active ORDER BY c.sort_order,m.created_at,m.name`,
    [restaurantId],
  );
  const allSchedules = (await schedules(restaurantId, db)).filter(
    (value) => value.active,
  );
  const local = localClock(now, restaurant.timezone);
  const current = allSchedules.filter((value) =>
    scheduleIsActive(value, local.day, local.minute),
  );
  const eligible = allSchedules.length
    ? items.filter((item) =>
        current.some(
          (value) =>
            value.category_ids.includes(item.category_id) ||
            value.item_ids.includes(item.id),
        ),
      )
    : items;
  const components = await db.query<{
    combo_item_id: string;
    component_item_id: string;
    quantity: number;
    name: string;
    price: number;
    active: boolean;
    available: boolean;
    sold_out: boolean;
  }>(
    `SELECT ci.*,m.name,m.price,m.active,m.available,m.sold_out FROM menu_combo_items ci JOIN menu_items m ON m.id=ci.component_item_id JOIN menu_items combo ON combo.id=ci.combo_item_id WHERE combo.restaurant_id=$1 ORDER BY m.name`,
    [restaurantId],
  );
  return eligible.map((item) => {
    const parts = components.filter((part) => part.combo_item_id === item.id);
    return {
      ...item,
      available:
        item.available &&
        !item.sold_out &&
        parts.every((part) => part.active && part.available && !part.sold_out),
      components: parts.map((part) => ({
        itemId: part.component_item_id,
        name: part.name,
        quantity: part.quantity,
      })),
      original_price: parts.reduce(
        (sum, part) => sum + part.price * part.quantity,
        0,
      ),
    };
  });
}

export async function publicMenu(slug: string, now = new Date()) {
  const [restaurant] = await (
    await getDb()
  ).query<{ id: string }>(
    "SELECT id FROM restaurants WHERE slug=$1 AND active=true",
    [slug],
  );
  if (!restaurant) throw new AppError("Restaurant not found", 404);
  return menuForRestaurantId(restaurant.id, undefined, now);
}

export async function adminMenu(restaurantId: string): Promise<ManagedMenu> {
  const db = await getDb();
  const categories = await db.query<MenuCategory>(
    "SELECT id,name,sort_order,active FROM menu_categories WHERE restaurant_id=$1 ORDER BY sort_order,name",
    [restaurantId],
  );
  const items = await db.query<MenuItem>(
    `SELECT m.*,c.name AS category,c.sort_order FROM menu_items m JOIN menu_categories c ON c.id=m.category_id WHERE m.restaurant_id=$1 ORDER BY c.sort_order,m.name`,
    [restaurantId],
  );
  const parts = await db.query<{
    combo_item_id: string;
    item_id: string;
    name: string;
    quantity: number;
  }>(
    "SELECT ci.combo_item_id,m.id AS item_id,m.name,ci.quantity FROM menu_combo_items ci JOIN menu_items m ON m.id=ci.component_item_id JOIN menu_items combo ON combo.id=ci.combo_item_id WHERE combo.restaurant_id=$1 ORDER BY m.name",
    [restaurantId],
  );
  for (const item of items)
    item.components = parts
      .filter((part) => part.combo_item_id === item.id)
      .map((part) => ({
        itemId: part.item_id,
        name: part.name,
        quantity: part.quantity,
      }));
  return {
    categories,
    items,
    schedules: await schedules(restaurantId, db),
  };
}

export async function saveCategory(restaurantId: string, raw: unknown) {
  const value = categoryInput.parse(raw);
  return (await getDb()).transaction(async (tx) => {
    const [row] = value.id
      ? await tx.query<MenuCategory>(
          "UPDATE menu_categories SET name=$3,sort_order=$4,active=$5,updated_at=now() WHERE id=$1 AND restaurant_id=$2 RETURNING *",
          [value.id, restaurantId, value.name, value.sortOrder, value.active],
        )
      : await tx.query<MenuCategory>(
          "INSERT INTO menu_categories(restaurant_id,name,sort_order,active) VALUES($1,$2,$3,$4) RETURNING *",
          [restaurantId, value.name, value.sortOrder, value.active],
        );
    if (!row) throw new AppError("Category not found", 404);
    await audit(tx, restaurantId, "admin", "menu_category_save", row.id, value);
    return row;
  });
}

export async function saveItem(restaurantId: string, raw: unknown) {
  const value = itemInput.parse(raw);
  return (await getDb()).transaction(async (tx) => {
    const [category] = await tx.query<{ id: string }>(
      "SELECT id FROM menu_categories WHERE id=$1 AND restaurant_id=$2",
      [value.categoryId, restaurantId],
    );
    if (!category) throw new AppError("Choose a valid category");
    const componentIds = value.components.map((component) => component.itemId);
    if (value.id && componentIds.includes(value.id))
      throw new AppError("A combo cannot contain itself");
    if (componentIds.length) {
      const valid = await tx.query<{ id: string }>(
        "SELECT id FROM menu_items WHERE restaurant_id=$1 AND id=ANY($2::uuid[]) AND item_type='item'",
        [restaurantId, componentIds],
      );
      if (valid.length !== componentIds.length)
        throw new AppError("Choose valid regular menu items for the combo");
    }
    const params = [
      restaurantId,
      value.categoryId,
      value.name,
      value.description,
      value.price,
      value.imageUrl || null,
      value.vegetarian,
      value.available,
      value.soldOut,
      value.active,
      value.itemType,
    ];
    const [row] = value.id
      ? await tx.query<MenuItem>(
          "UPDATE menu_items SET category_id=$2,name=$3,description=$4,price=$5,image_url=$6,vegetarian=$7,available=$8,sold_out=$9,active=$10,item_type=$11,updated_at=now() WHERE id=$12 AND restaurant_id=$1 RETURNING *",
          [...params, value.id],
        )
      : await tx.query<MenuItem>(
          "INSERT INTO menu_items(restaurant_id,category_id,name,description,price,image_url,vegetarian,available,sold_out,active,item_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
          params,
        );
    if (!row) throw new AppError("Menu item not found", 404);
    await tx.query("DELETE FROM menu_combo_items WHERE combo_item_id=$1", [
      row.id,
    ]);
    for (const component of value.components)
      await tx.query(
        "INSERT INTO menu_combo_items(combo_item_id,component_item_id,quantity) VALUES($1,$2,$3)",
        [row.id, component.itemId, component.quantity],
      );
    await audit(tx, restaurantId, "admin", "menu_item_save", row.id, value);
    return row;
  });
}

export async function saveSchedule(restaurantId: string, raw: unknown) {
  const value = scheduleInput.parse(raw);
  return (await getDb()).transaction(async (tx) => {
    const [row] = value.id
      ? await tx.query<MenuSchedule>(
          "UPDATE menu_schedules SET name=$3,start_time=$4,end_time=$5,days=$6,active=$7,updated_at=now() WHERE id=$1 AND restaurant_id=$2 RETURNING *",
          [
            value.id,
            restaurantId,
            value.name,
            value.startTime,
            value.endTime,
            value.days,
            value.active,
          ],
        )
      : await tx.query<MenuSchedule>(
          "INSERT INTO menu_schedules(restaurant_id,name,start_time,end_time,days,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [
            restaurantId,
            value.name,
            value.startTime,
            value.endTime,
            value.days,
            value.active,
          ],
        );
    if (!row) throw new AppError("Menu schedule not found", 404);
    await tx.query(
      "DELETE FROM menu_schedule_categories WHERE schedule_id=$1",
      [row.id],
    );
    await tx.query("DELETE FROM menu_schedule_items WHERE schedule_id=$1", [
      row.id,
    ]);
    for (const id of value.categoryIds)
      await tx.query(
        "INSERT INTO menu_schedule_categories(schedule_id,category_id) SELECT $1,id FROM menu_categories WHERE id=$2 AND restaurant_id=$3",
        [row.id, id, restaurantId],
      );
    for (const id of value.itemIds)
      await tx.query(
        "INSERT INTO menu_schedule_items(schedule_id,menu_item_id) SELECT $1,id FROM menu_items WHERE id=$2 AND restaurant_id=$3",
        [row.id, id, restaurantId],
      );
    await audit(tx, restaurantId, "admin", "menu_schedule_save", row.id, value);
    return row;
  });
}

export async function deactivateMenu(
  restaurantId: string,
  kind: "category" | "item" | "schedule",
  id: string,
) {
  const table = {
    category: "menu_categories",
    item: "menu_items",
    schedule: "menu_schedules",
  }[kind];
  return (await getDb()).transaction(async (tx) => {
    const rows = await tx.query<{ id: string }>(
      `UPDATE ${table} SET active=false,updated_at=now() WHERE id=$1 AND restaurant_id=$2 RETURNING id`,
      [id, restaurantId],
    );
    if (!rows.length) throw new AppError("Menu record not found", 404);
    await audit(tx, restaurantId, "admin", `menu_${kind}_deactivate`, id, {});
    return { ok: true };
  });
}
