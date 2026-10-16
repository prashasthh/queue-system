import { notFound } from "next/navigation";
import { Shell } from "@/components/ui/common";
import {
  PriorityOptions,
  PriorityReview,
} from "@/components/priority/purchase";
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!["queue", "reservation", "review"].includes(kind)) notFound();
  return (
    <Shell>
      {kind === "review" ? (
        <PriorityReview id={id} />
      ) : (
        <PriorityOptions kind={kind as "queue" | "reservation"} id={id} />
      )}
    </Shell>
  );
}
