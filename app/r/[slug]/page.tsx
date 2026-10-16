import { notFound } from "next/navigation";
import { restaurant } from "@/lib/queue/service";
import { Shell } from "@/components/ui/common";
import Link from "next/link";
import { publicMenu } from "@/lib/menu/service";
import { PublicMenu } from "@/components/menu/public-menu";
import {
  ArrowRight,
  Clock3,
  MapPin,
  MessageCircle,
  Users,
  UtensilsCrossed,
} from "lucide-react";
export const dynamic = "force-dynamic";
export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await restaurant(slug).catch((e) => {
    if (e.status === 404) notFound();
    throw e;
  });
  const preview = (await publicMenu(slug)).slice(0, 4);
  return (
    <Shell wide>
      <div className="mb-10 flex items-center gap-2 text-xs font-medium text-stone-500">
        <span className="h-2 w-2 rounded-full bg-[#9a624c]" />
        Accepting guests <span className="mx-2 text-stone-300">/</span> {r.name}
      </div>
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <p className="eyebrow mb-6 text-brand">
            Your table is worth it. The wait shouldn’t be.
          </p>
          <h1 className="serif text-5xl leading-[1.08] tracking-tight sm:text-7xl">
            Good food.
            <br />
            Less <span className="italic text-brand">waiting.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-stone-500">
            Welcome to {r.name}. Save your spot, find your favourites, and let
            us take care of the rest.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href={`/r/${slug}/walk-in`} className="btn">
              Walk-in · Join the queue <ArrowRight size={16} />
            </Link>
            <Link href={`/r/${slug}/reservation`} className="btn btn-secondary">
              Reservation
            </Link>
            <Link href={`/r/${slug}/menu`} className="text-brand font-semibold">
              View full menu →
            </Link>
            <span className="text-xs text-stone-500">
              No app download needed
            </span>
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs text-stone-500">
            <MapPin size={14} />
            {r.address}
          </p>
        </section>
        <section className="relative overflow-hidden rounded-[28px] bg-[#eadfd5] p-7 sm:p-10">
          <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full border-[30px] border-white/30" />
          <div className="relative">
            <div className="mb-12 flex items-center justify-between">
              <span className="eyebrow text-[#4a3025]">
                A seat at our table
              </span>
              <UtensilsCrossed size={22} className="text-[#6f4636]" />
            </div>
            <div className="rounded-2xl bg-white p-7 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  The queue, right now
                </span>
                <span className="rounded-full bg-[#f7eee8] px-2 py-1 text-[10px] font-bold text-[#79503e]">
                  AT PAGE LOAD
                </span>
              </div>
              <div className="my-7 grid grid-cols-2 divide-x divide-stone-200">
                <div>
                  <p className="serif text-5xl">{r.waiting_count}</p>
                  <p className="mt-2 text-xs text-stone-500">parties waiting</p>
                </div>
                <div className="pl-7">
                  <p className="serif text-5xl">
                    {r.waiting_count * r.average_service_minutes}
                    <span className="ml-1 font-sans text-sm">min</span>
                  </p>
                  <p className="mt-2 text-xs text-stone-500">estimated wait</p>
                </div>
              </div>
              <p className="border-t border-dashed border-stone-200 pt-4 text-xs leading-5 text-stone-500">
                Your spot stays with you. We’ll send a WhatsApp update when your
                table is almost ready.
              </p>
            </div>
            <p className="mt-5 text-center text-xs text-[#4a3025]/60">
              Made for good company & great conversations.
            </p>
          </div>
        </section>
      </div>
      <section className="mt-12">
        <h2 className="serif mb-6 text-3xl">A taste of what’s waiting.</h2>
        <PublicMenu items={preview} />
      </section>
      <section className="mt-16 grid gap-6 border-t border-stone-200 pt-8 sm:grid-cols-3">
        {[
          {
            Icon: Users,
            n: "01",
            title: "Save your spot",
            text: "Join with your name, number and party size.",
          },
          {
            Icon: MessageCircle,
            n: "02",
            title: "Make yourself at home",
            text: "Follow your place and get WhatsApp updates.",
          },
          {
            Icon: Clock3,
            n: "03",
            title: "Order ahead",
            text: "Explore the menu, review your order and pay.",
          },
        ].map(({ Icon, n, title, text }) => (
          <div key={n} className="flex gap-4">
            <Icon className="mt-1 shrink-0 text-brand" size={21} />
            <div>
              <p className="mb-2 text-xs text-stone-400">{n}</p>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">{text}</p>
            </div>
          </div>
        ))}
      </section>
    </Shell>
  );
}
