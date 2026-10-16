"use client";
import { useState } from "react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import type { MenuItem } from "@/types";
import type {
  ManagedMenu,
  MenuCategory,
  MenuSchedule,
} from "@/lib/menu/service";
import { money } from "@/lib/utils/format";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const checked = (form: FormData, name: string) => form.get(name) === "on";

export function MenuManager() {
  const { data, error, refresh } = useData<ManagedMenu>("/api/admin/menu"),
    [failure, setFailure] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [category, setCategory] = useState<MenuCategory | null>(null),
    [item, setItem] = useState<MenuItem | null>(null),
    [schedule, setSchedule] = useState<MenuSchedule | null>(null);
  async function mutate(
    entity: "category" | "item" | "schedule",
    value: unknown,
  ) {
    setBusy(true);
    setFailure("");
    try {
      await api("/api/admin/menu", { entity, value });
      setNotice(`${entity[0].toUpperCase()}${entity.slice(1)} saved`);
      await refresh();
      if (entity === "category") setCategory(null);
      if (entity === "item") setItem(null);
      if (entity === "schedule") setSchedule(null);
    } catch (reason) {
      setFailure((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deactivate(
    entity: "category" | "item" | "schedule",
    id: string,
  ) {
    setBusy(true);
    setFailure("");
    try {
      await api("/api/admin/menu", { entity, id }, "DELETE");
      setNotice(`${entity[0].toUpperCase()}${entity.slice(1)} deactivated`);
      await refresh();
    } catch (reason) {
      setFailure((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <>
        <Notice message={error} />
        <Loading error={error} />
      </>
    );
  const regularItems = data.items.filter((value) => value.item_type === "item");
  return (
    <div className="space-y-8">
      <Notice message={error || failure} />
      <Notice message={notice} success />
      <section className="grid gap-5 xl:grid-cols-[1fr_1.5fr]">
        <CategoryForm
          key={category?.id || "new-category"}
          value={category}
          busy={busy}
          onCancel={() => setCategory(null)}
          onSave={(value) => mutate("category", value)}
        />
        <div className="panel">
          <h2 className="serif mb-4 text-2xl">Categories</h2>
          <div className="space-y-2">
            {data.categories.map((value) => (
              <div
                key={value.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 p-3"
              >
                <div>
                  <strong>{value.name}</strong>
                  <span className="ml-2 text-xs text-stone-500">
                    Order {value.sort_order} ·{" "}
                    {value.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-brand text-xs"
                    onClick={() => setCategory(value)}
                  >
                    Edit
                  </button>
                  {value.active && (
                    <button
                      className="text-xs text-red-700"
                      disabled={busy}
                      onClick={() => void deactivate("category", value.id)}
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ItemForm
        key={item?.id || "new-item"}
        value={item}
        categories={data.categories}
        regularItems={regularItems}
        busy={busy}
        onCancel={() => setItem(null)}
        onSave={(value) => mutate("item", value)}
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.items.map((value) => (
          <article className="panel" key={value.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-stone-500">{value.category}</p>
                <h3 className="mt-1 font-semibold">{value.name}</h3>
              </div>
              <Badge
                status={
                  !value.active
                    ? "inactive"
                    : value.sold_out
                      ? "sold out"
                      : value.available
                        ? "available"
                        : "unavailable"
                }
              />
            </div>
            <p className="my-3 text-sm text-stone-500">{value.description}</p>
            <p className="font-semibold">{money(value.price)}</p>
            {!!value.components?.length && (
              <p className="mt-2 text-xs text-stone-500">
                {value.components
                  .map((part) => `${part.quantity} × ${part.name}`)
                  .join(" · ")}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <button className="text-brand" onClick={() => setItem(value)}>
                Edit
              </button>
              {value.active && (
                <button
                  className="text-red-700"
                  disabled={busy}
                  onClick={() => void deactivate("item", value.id)}
                >
                  Deactivate
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      <ScheduleForm
        key={schedule?.id || "new-schedule"}
        value={schedule}
        categories={data.categories}
        items={data.items}
        busy={busy}
        onCancel={() => setSchedule(null)}
        onSave={(value) => mutate("schedule", value)}
      />
      <section className="grid gap-4 md:grid-cols-2">
        {data.schedules.map((value) => (
          <article className="panel" key={value.id}>
            <div className="flex justify-between gap-3">
              <h3 className="font-semibold">{value.name}</h3>
              <Badge status={value.active ? "active" : "inactive"} />
            </div>
            <p className="my-2 text-sm">
              {value.start_time.slice(0, 5)}–{value.end_time.slice(0, 5)} IST
            </p>
            <p className="text-xs text-stone-500">
              {value.days.map((day) => days[day]).join(", ")}
            </p>
            <div className="mt-4 flex gap-3 text-xs">
              <button className="text-brand" onClick={() => setSchedule(value)}>
                Edit
              </button>
              {value.active && (
                <button
                  className="text-red-700"
                  disabled={busy}
                  onClick={() => void deactivate("schedule", value.id)}
                >
                  Deactivate
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function CategoryForm({
  value,
  busy,
  onSave,
  onCancel,
}: {
  value: MenuCategory | null;
  busy: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="panel space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          id: value?.id,
          name: form.get("name"),
          sortOrder: Number(form.get("sortOrder")),
          active: checked(form, "active"),
        });
      }}
    >
      <h2 className="serif text-2xl">
        {value ? "Edit category" : "New category"}
      </h2>
      <input
        name="name"
        required
        minLength={2}
        defaultValue={value?.name}
        placeholder="Category name"
      />
      <input
        name="sortOrder"
        required
        type="number"
        min="0"
        defaultValue={value?.sort_order ?? 0}
        placeholder="Sort order"
      />
      <label className="flex gap-2 text-sm">
        <input
          name="active"
          type="checkbox"
          defaultChecked={value?.active ?? true}
        />{" "}
        Active
      </label>
      <div className="flex gap-3">
        <button disabled={busy} className="btn">
          Save category
        </button>
        {value && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ItemForm({
  value,
  categories,
  regularItems,
  busy,
  onSave,
  onCancel,
}: {
  value: MenuItem | null;
  categories: MenuCategory[];
  regularItems: MenuItem[];
  busy: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState(value?.item_type || "item");
  return (
    <form
      className="panel space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          id: value?.id,
          categoryId: form.get("categoryId"),
          name: form.get("name"),
          description: form.get("description"),
          price: Math.round(Number(form.get("price")) * 100),
          imageUrl: form.get("imageUrl"),
          vegetarian: checked(form, "vegetarian"),
          available: checked(form, "available"),
          soldOut: checked(form, "soldOut"),
          active: checked(form, "active"),
          itemType: type,
          components:
            type === "combo"
              ? regularItems
                  .filter((part) => checked(form, `part-${part.id}`))
                  .map((part) => ({
                    itemId: part.id,
                    quantity: Number(form.get(`quantity-${part.id}`) || 1),
                  }))
              : [],
        });
      }}
    >
      <div>
        <h2 className="serif text-2xl">
          {value ? "Edit menu item" : "New menu item or combo"}
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          Prices are entered in rupees and stored as integer paise.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <select
          name="categoryId"
          required
          defaultValue={value?.category_id || ""}
        >
          <option value="">Choose category</option>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as "item" | "combo")}
        >
          <option value="item">Regular item</option>
          <option value="combo">Combo</option>
        </select>
        <input
          name="name"
          required
          minLength={2}
          defaultValue={value?.name}
          placeholder="Item name"
        />
      </div>
      <textarea
        name="description"
        maxLength={1000}
        defaultValue={value?.description}
        placeholder="Description"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <input
          name="price"
          required
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={value ? value.price / 100 : ""}
          placeholder="Price in ₹"
        />
        <input
          name="imageUrl"
          type="url"
          defaultValue={value?.image_url || ""}
          placeholder="Image URL (optional)"
        />
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        {[
          ["vegetarian", "Vegetarian", value?.vegetarian ?? true],
          ["available", "Available", value?.available ?? true],
          ["soldOut", "Sold out", value?.sold_out ?? false],
          ["active", "Active", value?.active ?? true],
        ].map(([name, label, initial]) => (
          <label className="flex gap-2" key={String(name)}>
            <input
              name={String(name)}
              type="checkbox"
              defaultChecked={Boolean(initial)}
            />{" "}
            {String(label)}
          </label>
        ))}
      </div>
      {type === "combo" && (
        <fieldset className="rounded-xl border border-stone-200 p-4">
          <legend className="px-2 text-sm font-semibold">
            Combo components
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {regularItems.map((part) => {
              const selected = value?.components?.find(
                (component) => component.itemId === part.id,
              );
              return (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={part.id}
                >
                  <input
                    name={`part-${part.id}`}
                    type="checkbox"
                    defaultChecked={!!selected}
                  />
                  <span className="flex-1">{part.name}</span>
                  <input
                    className="!w-20"
                    name={`quantity-${part.id}`}
                    type="number"
                    min="1"
                    max="20"
                    defaultValue={selected?.quantity || 1}
                    aria-label={`${part.name} quantity`}
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="flex gap-3">
        <button disabled={busy} className="btn">
          Save item
        </button>
        {value && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ScheduleForm({
  value,
  categories,
  items,
  busy,
  onSave,
  onCancel,
}: {
  value: MenuSchedule | null;
  categories: MenuCategory[];
  items: MenuItem[];
  busy: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="panel space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          id: value?.id,
          name: form.get("name"),
          startTime: form.get("startTime"),
          endTime: form.get("endTime"),
          days: days
            .map((_, index) => index)
            .filter((index) => checked(form, `day-${index}`)),
          categoryIds: categories
            .filter((entry) => checked(form, `category-${entry.id}`))
            .map((entry) => entry.id),
          itemIds: items
            .filter((entry) => checked(form, `item-${entry.id}`))
            .map((entry) => entry.id),
          active: checked(form, "active"),
        });
      }}
    >
      <div>
        <h2 className="serif text-2xl">
          {value ? "Edit schedule" : "New menu schedule"}
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          Times use Asia/Kolkata. Overnight ranges apply after midnight to the
          previous service day.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <input
          name="name"
          required
          minLength={2}
          defaultValue={value?.name}
          placeholder="Breakfast, lunch…"
        />
        <input
          name="startTime"
          required
          type="time"
          defaultValue={value?.start_time?.slice(0, 5)}
        />
        <input
          name="endTime"
          required
          type="time"
          defaultValue={value?.end_time?.slice(0, 5)}
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Days</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {days.map((label, index) => (
            <label key={label} className="flex gap-1.5">
              <input
                name={`day-${index}`}
                type="checkbox"
                defaultChecked={value?.days.includes(index) ?? true}
              />{" "}
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 md:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Categories in this schedule
          </legend>
          {categories.map((entry) => (
            <label key={entry.id} className="mb-2 flex gap-2 text-sm">
              <input
                name={`category-${entry.id}`}
                type="checkbox"
                defaultChecked={value?.category_ids.includes(entry.id)}
              />{" "}
              {entry.name}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Specific items</legend>
          <div className="max-h-48 overflow-auto">
            {items.map((entry) => (
              <label key={entry.id} className="mb-2 flex gap-2 text-sm">
                <input
                  name={`item-${entry.id}`}
                  type="checkbox"
                  defaultChecked={value?.item_ids.includes(entry.id)}
                />{" "}
                {entry.name}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <label className="flex gap-2 text-sm">
        <input
          name="active"
          type="checkbox"
          defaultChecked={value?.active ?? true}
        />{" "}
        Active
      </label>
      <div className="flex gap-3">
        <button disabled={busy} className="btn">
          Save schedule
        </button>
        {value && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
