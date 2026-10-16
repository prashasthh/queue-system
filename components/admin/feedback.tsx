"use client";
import { Loading, Notice, useData } from "../ui/common";
interface FeedbackData {
  averages: {
    food: number | null;
    service: number | null;
    waiting: number | null;
    cleanliness: number | null;
    responses: number;
  };
  recent: Array<{
    id: string;
    name: string;
    queue_number: string;
    comment: string;
    average: number;
    created_at: string;
  }>;
}
export function FeedbackDashboard() {
  const { data, error } = useData<FeedbackData>("/api/admin/feedback", 10000);
  if (!data)
    return (
      <>
        <Notice message={error} />
        <Loading error={error} />
      </>
    );
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Food", data.averages.food],
          ["Service", data.averages.service],
          ["Waiting", data.averages.waiting],
          ["Cleanliness", data.averages.cleanliness],
          ["Responses", data.averages.responses],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <p className="text-xs text-stone-500">{label}</p>
            <p className="serif mt-3 text-3xl">{value ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {data.recent.map((entry) => (
          <article className="panel" key={entry.id}>
            <div className="flex justify-between gap-3">
              <strong>
                {entry.name} · {entry.queue_number}
              </strong>
              <span>{entry.average.toFixed(1)} / 5</span>
            </div>
            <p className="mt-3 text-sm text-stone-600">
              {entry.comment || "No written comment."}
            </p>
          </article>
        ))}
        {!data.recent.length && (
          <p className="panel text-stone-500">No feedback yet.</p>
        )}
      </div>
    </>
  );
}
