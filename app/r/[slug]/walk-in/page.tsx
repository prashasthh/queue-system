import Link from "next/link";
import { Shell } from "@/components/ui/common";
import { JoinForm } from "@/components/queue/join-form";
import { restaurant } from "@/lib/queue/service";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    r = await restaurant(slug);
  return (
    <Shell>
      <Link href={`/r/${slug}/menu`} className="text-brand">
        Browse the menu first →
      </Link>
      <p className="eyebrow mt-6">{r.name} · Walk-in</p>
      <h1 className="serif my-4 text-4xl">A seat is worth the wait.</h1>
      <div className="panel">
        <JoinForm slug={slug} />
      </div>
    </Shell>
  );
}
