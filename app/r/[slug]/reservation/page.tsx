import Link from "next/link";
import { Shell } from "@/components/ui/common";
import { ReservationForm } from "@/components/reservations/form";
import { restaurant } from "@/lib/queue/service";
import { settings } from "@/lib/settings/service";
export const dynamic = "force-dynamic";
function dateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    r = await restaurant(slug),
    s = await settings(r.id),
    now = new Date(),
    max = new Date(now.getTime() + 89 * 86400000);
  return (
    <Shell>
      <Link href={`/r/${slug}/menu`} className="text-brand">
        Browse the menu first →
      </Link>
      <p className="eyebrow mt-6">{r.name}</p>
      <h1 className="serif my-4 text-4xl">Make time for good food.</h1>
      <p className="mb-6 text-stone-500">
        Reserve your visit · {s.opening_time.slice(0, 5)}–
        {s.closing_time.slice(0, 5)} IST · allow {s.occupancy_minutes} minutes
        for dining.
      </p>
      <ReservationForm
        slug={slug}
        openingTime={s.opening_time.slice(0, 5)}
        closingTime={s.closing_time.slice(0, 5)}
        occupancyMinutes={s.occupancy_minutes}
        minDate={dateInTimezone(now, r.timezone)}
        maxDate={dateInTimezone(max, r.timezone)}
      />
    </Shell>
  );
}
