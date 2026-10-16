import { CustomersDashboard } from "@/components/admin/customers";
export default function Page() {
  return (
    <>
      <p className="eyebrow text-brand">Guest history</p>
      <h1 className="serif mb-7 text-4xl">Customers</h1>
      <CustomersDashboard />
    </>
  );
}
