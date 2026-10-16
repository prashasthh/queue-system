"use client";
import { useState } from "react";
import { api, Loading, Notice, useData } from "../ui/common";

interface Visit {
  status: string;
  queue_number: string;
  restaurant_name: string;
  customer_name: string;
  feedback_id: string | null;
}
export function FeedbackForm({ id, token }: { id: string; token: string }) {
  const { data, error } = useData<Visit>(
      `/api/feedback/${id}?token=${encodeURIComponent(token)}`,
    ),
    [failure, setFailure] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  if (!data)
    return (
      <>
        <Notice message={error} />
        <Loading error={error} />
      </>
    );
  if (data.feedback_id || done)
    return (
      <div className="panel text-center">
        <p className="eyebrow text-brand">Feedback received</p>
        <h1 className="serif my-4 text-4xl">
          Thank you, {data.customer_name}.
        </h1>
        <p className="text-stone-500">
          Your feedback helps the restaurant improve.
        </p>
      </div>
    );
  return (
    <form
      className="panel space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setFailure("");
        const form = new FormData(event.currentTarget);
        try {
          await api(`/api/feedback/${id}`, {
            token,
            feedback: {
              foodQualityRating: Number(form.get("food")),
              serviceRating: Number(form.get("service")),
              waitingTimeRating: Number(form.get("waiting")),
              cleanlinessRating: Number(form.get("cleanliness")),
              comment: form.get("comment"),
            },
          });
          setDone(true);
        } catch (reason) {
          setFailure((reason as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <p className="eyebrow text-brand">
          {data.restaurant_name} · {data.queue_number}
        </p>
        <h1 className="serif mt-3 text-4xl">How was your visit?</h1>
      </div>
      {[
        ["food", "Food quality"],
        ["service", "Service"],
        ["waiting", "Waiting time"],
        ["cleanliness", "Cleanliness"],
      ].map(([name, label]) => (
        <label className="field-label" key={name}>
          {label}
          <select
            name={name}
            required
            defaultValue="5"
            className="field-control"
          >
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} star{rating === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="field-label">
        Comment (optional)
        <textarea name="comment" maxLength={1000} className="field-control" />
      </label>
      <Notice message={error || failure} />
      <button
        className="btn w-full"
        disabled={busy || data.status !== "completed"}
      >
        {data.status !== "completed"
          ? "Feedback opens after your visit"
          : busy
            ? "Sending…"
            : "Send feedback"}
      </button>
    </form>
  );
}
