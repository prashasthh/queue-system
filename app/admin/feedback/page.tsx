import { FeedbackDashboard } from "@/components/admin/feedback";
export default function Page() {
  return (
    <>
      <p className="eyebrow text-brand">Guest voice</p>
      <h1 className="serif mb-7 text-4xl">Feedback</h1>
      <FeedbackDashboard />
    </>
  );
}
