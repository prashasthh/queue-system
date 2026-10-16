import { Shell, Steps } from "@/components/ui/common";
import { QueueStatus } from "@/components/queue/status";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Shell>
      <Steps active={0} />
      <QueueStatus id={id} />
    </Shell>
  );
}
