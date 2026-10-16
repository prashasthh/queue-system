import { Shell, Steps } from "@/components/ui/common";
import { Review } from "@/components/cart/review";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Shell>
      <Steps active={2} />
      <Review id={(await params).id} />
    </Shell>
  );
}
