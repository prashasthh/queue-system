import Image from "next/image";
import type { MenuItem } from "@/types";
import { money } from "@/lib/utils/format";
export function PublicMenu({ items }: { items: MenuItem[] }) {
  return (
    <div className="space-y-8">
      {!items.length && (
        <p className="panel">No menu items are available at this time.</p>
      )}
      {[...new Set(items.map((i) => i.category))].map((category) => (
        <section key={category}>
          <h2 className="serif mb-4 text-3xl">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {items
              .filter((i) => i.category === category)
              .map((i) => (
                <article key={i.id} className="panel">
                  {i.image_url && (
                    <Image
                      src={i.image_url}
                      alt={i.name}
                      width={720}
                      height={720}
                      sizes="(min-width: 640px) 560px, calc(100vw - 72px)"
                      className="mb-5 h-56 w-full rounded-2xl object-cover"
                    />
                  )}
                  <div className="flex justify-between gap-3">
                    <h3 className="font-semibold">{i.name}</h3>
                    <span className="text-brand">{money(i.price)}</span>
                  </div>
                  <p className="my-3 text-sm text-stone-500">{i.description}</p>
                  {!!i.components?.length && (
                    <p className="mb-3 text-xs text-stone-500">
                      Includes{" "}
                      {i.components
                        .map((part) => `${part.quantity} × ${part.name}`)
                        .join(", ")}
                      {!!i.original_price && i.original_price > i.price && (
                        <> · Usually {money(i.original_price)}</>
                      )}
                    </p>
                  )}
                  <span className="text-xs">
                    {!i.available
                      ? "Sold out"
                      : i.vegetarian
                        ? "Vegetarian · Available"
                        : "Available"}
                  </span>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
