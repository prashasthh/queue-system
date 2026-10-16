import Link from "next/link";
import { Shell } from "@/components/ui/common";
import { PublicMenu } from "@/components/menu/public-menu";
import { publicMenu } from "@/lib/menu/service";
import { restaurant } from "@/lib/queue/service";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    [r, items] = await Promise.all([restaurant(slug), publicMenu(slug)]);
  return (
    <Shell wide>
      <p className="eyebrow">{r.name}</p>
      <h1 className="serif my-4 text-5xl">Something for every craving.</h1>
      <p className="mb-6 text-stone-500">
        Browse first. Choose your visit when you’re ready.
      </p>
      <div className="mb-10 flex gap-3">
        <Link className="btn" href={`/r/${slug}/walk-in`}>
          Walk-in
        </Link>
        <Link className="btn btn-secondary" href={`/r/${slug}/reservation`}>
          Reservation
        </Link>
      </div>
      <PublicMenu items={items} />
    </Shell>
  );
}
