import { Shell, Steps } from "@/components/ui/common";
import { Menu } from "@/components/menu/menu";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Shell wide>
      <Steps active={1} />
      <Menu id={(await params).id} />
    </Shell>
  );
}
