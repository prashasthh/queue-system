"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Loading, Notice, useData } from "../ui/common";
import { useCart } from "../cart/store";
import type { MenuItem } from "@/types";
import { money } from "@/lib/utils/format";
export function Menu({ id }: { id: string }) {
  const { data: items, error } = useData<MenuItem[]>(`/api/menu/${id}`);
  const { cart, update, ready } = useCart(id);
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total =
    items?.reduce((sum, m) => sum + (cart[m.id] || 0) * m.price, 0) || 0;
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="eyebrow text-brand">Made with care · Demo Restaurant</p>
        <Link
          href={`/queue/${id}`}
          className="text-xs text-stone-500 underline"
        >
          My queue
        </Link>
      </div>
      <h1 className="serif my-4 text-5xl">What sounds good?</h1>
      <p className="mb-8 text-stone-500">
        Familiar favourites. A little something for everyone.
      </p>
      <Notice message={error} />
      {!items || !ready ? (
        <Loading error={error} />
      ) : (
        <>
          <nav className="mb-8 flex flex-wrap gap-2">
            {["All", ...new Set(items.map((m) => m.category))].map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full border px-4 py-2 text-sm ${c === filter ? "border-ink bg-ink text-white" : "border-stone-200 bg-white"}`}
              >
                {c}
              </button>
            ))}
          </nav>
          {!items.length && (
            <div className="panel">
              The menu is currently unavailable. Please ask your host.
            </div>
          )}
          {[...new Set(items.map((m) => m.category))]
            .filter((c) => filter === "All" || c === filter)
            .map((category) => (
              <section key={category} className="mb-9">
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-stone-200" />
                  <h2 className="serif text-2xl">{category}</h2>
                  <span className="h-px flex-1 bg-stone-200" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {items
                    .filter((m) => m.category === category)
                    .map((m) => (
                      <article
                        className="panel menu-card flex flex-col"
                        key={m.id}
                      >
                        {m.image_url && (
                          <Image
                            src={m.image_url}
                            alt={m.name}
                            width={720}
                            height={720}
                            sizes="(min-width: 640px) 340px, calc(100vw - 72px)"
                            className="mb-5 h-48 w-full rounded-2xl object-cover"
                          />
                        )}
                        <div className="mb-4 flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-widest ${m.vegetarian ? "text-[#79503e]" : "text-brand"}`}
                          >
                            ◉ {m.vegetarian ? "Vegetarian" : "Non-vegetarian"}
                          </span>
                          {!m.available && (
                            <span className="text-xs text-stone-400">
                              Sold out
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold">{m.name}</h3>
                        <p className="mb-6 mt-2 flex-1 text-sm leading-6 text-stone-500">
                          {m.description}
                        </p>
                        {!!m.components?.length && (
                          <p className="mb-4 text-xs text-stone-500">
                            {m.components
                              .map((part) => `${part.quantity} × ${part.name}`)
                              .join(" · ")}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {money(m.price)}
                          </span>
                          {cart[m.id] ? (
                            <div className="flex items-center gap-3">
                              <button
                                className="rounded-lg border p-2"
                                aria-label={`Remove one ${m.name}`}
                                onClick={() => update(m.id, cart[m.id] - 1)}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="text-sm">{cart[m.id]}</span>
                              <button
                                className="rounded-lg border p-2"
                                disabled={!m.available || cart[m.id] >= 20}
                                aria-label={`Add one ${m.name}`}
                                onClick={() => update(m.id, cart[m.id] + 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-secondary !px-4 !py-2"
                              disabled={!m.available}
                              onClick={() => {
                                update(m.id, 1);
                                setToast(`${m.name} added to your cart`);
                              }}
                            >
                              Add <Plus size={14} />
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                </div>
              </section>
            ))}
          <div
            role="status"
            aria-live="polite"
            className="text-sm text-[#79503e]"
          >
            {toast}
          </div>
          {count > 0 && (
            <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl bg-[#4a3025] p-4 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <ShoppingBag size={20} />
                <div>
                  <p className="text-sm font-semibold">
                    {count} items · {money(total)}
                  </p>
                  <p className="text-xs text-white/60">
                    A good meal is taking shape.
                  </p>
                </div>
              </div>
              <Link
                className="rounded-full bg-white px-4 py-3 text-sm font-bold text-[#4a3025]"
                href={`/cart/${id}`}
              >
                View cart →
              </Link>
            </div>
          )}
        </>
      )}
    </>
  );
}
