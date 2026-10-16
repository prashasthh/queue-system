import { Shell } from "@/components/ui/common";
import { ReservationStatus } from "@/components/reservations/status";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Shell>
      <ReservationStatus
        id={(await params).id}
        token={(await searchParams).token}
      />
    </Shell>
  );
}
