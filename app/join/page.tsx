import { Shell, Steps } from "@/components/ui/common";
import { JoinForm } from "@/components/queue/join-form";
import { Clock3, MessageCircle, Sparkles, UtensilsCrossed } from "lucide-react";
export default async function Join({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const { restaurant } = await searchParams;
  return (
    <Shell wide>
      <div className="mx-auto max-w-6xl">
        <Steps active={0} />
        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <aside className="restaurant-hero flex min-h-[500px] flex-col justify-between">
            <div className="relative z-10">
              <div className="mb-12 flex items-center justify-between">
                <p className="eyebrow text-[#f2c8b6]">Demo Restaurant</p>
                <UtensilsCrossed size={24} />
              </div>
              <h1 className="serif text-5xl leading-[1.05] sm:text-6xl">
                Your table is
                <br />
                <span className="italic text-[#efa98e]">almost ready.</span>
              </h1>
              <p className="mt-6 max-w-sm leading-7 text-white/70">
                Save your place, browse today’s menu, and enjoy the
                neighbourhood while we prepare your table.
              </p>
            </div>
            <div className="relative z-10 mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <Clock3 size={18} className="mb-3 text-[#efa98e]" />
                <p className="text-sm font-semibold">Live queue updates</p>
                <p className="mt-1 text-xs leading-5 text-white/55">
                  Know exactly where you stand.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <MessageCircle size={18} className="mb-3 text-[#efa98e]" />
                <p className="text-sm font-semibold">WhatsApp alerts</p>
                <p className="mt-1 text-xs leading-5 text-white/55">
                  We’ll message when it’s nearly time.
                </p>
              </div>
            </div>
          </aside>
          <section className="panel !p-6 sm:!p-10">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-brand">There’s a place for you</p>
                <h2 className="serif mt-3 text-4xl">Join the table.</h2>
                <p className="mt-3 text-sm leading-6 text-stone-500">
                  Just a few details, then you’re free to relax.
                </p>
              </div>
              <span className="rounded-full bg-[#f5e5dc] p-3 text-brand">
                <Sparkles size={20} />
              </span>
            </div>
            <JoinForm slug={restaurant || "demo-restaurant"} />
          </section>
        </div>
      </div>
    </Shell>
  );
}
