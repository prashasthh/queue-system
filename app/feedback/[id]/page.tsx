import { Shell } from "@/components/ui/common";
import { FeedbackForm } from "@/components/feedback/form";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Shell>
      <FeedbackForm
        id={(await params).id}
        token={(await searchParams).token || ""}
      />
    </Shell>
  );
}
