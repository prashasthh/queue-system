import { QueueDashboard } from "@/components/admin/dashboard";
import { Overview } from "@/components/admin/overview";
export default function Page() {
  return (
    <>
      <p className="eyebrow text-brand">Demo Restaurant · Host dashboard</p>
      <h1 className="serif mt-3 text-4xl">A smooth service starts here.</h1>
      <Overview />
      <QueueDashboard />
    </>
  );
}
