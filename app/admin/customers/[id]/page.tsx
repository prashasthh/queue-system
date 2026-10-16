import { CustomerDetail } from "@/components/admin/customer-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <CustomerDetail id={(await params).id} />;
}
