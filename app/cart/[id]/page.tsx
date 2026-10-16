import { Shell, Steps } from "@/components/ui/common";
import { Cart } from "@/components/cart/cart";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Shell>
      <Steps active={1} />
      <Cart id={(await params).id} />
    </Shell>
  );
}
