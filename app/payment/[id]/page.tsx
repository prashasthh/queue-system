import { Shell, Steps } from "@/components/ui/common";
import { Payment } from "@/components/cart/payment";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Shell>
      <Steps active={3} />
      <Payment id={(await params).id} />
    </Shell>
  );
}
