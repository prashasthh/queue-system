"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, Notice } from "../ui/common";
import { joinSchema } from "@/lib/validation";
import type { QueueEntry } from "@/types";
export function JoinForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          const input = joinSchema.parse({
            name: f.get("name"),
            phone: f.get("phone"),
            partySize: Number(f.get("partySize")),
            slug,
            requestId,
            consent: f.get("consent") === "on",
          });
          const entry = await api<QueueEntry>("/api/queue", input);
          router.push(
            f.get("priority") === "on"
              ? `/priority/queue/${entry.id}`
              : `/queue/${entry.id}`,
          );
        } catch (e) {
          setError(
            e instanceof Error
              ? "issues" in e
                ? "Please check your name, Indian mobile number, party size and consent."
                : e.message
              : "Could not join queue",
          );
          setBusy(false);
        }
      }}
    >
      <label className="field-label">
        Your name
        <input
          autoComplete="name"
          name="name"
          placeholder="e.g. Aditi Sharma"
          minLength={2}
          maxLength={80}
          required
          className="field-control"
        />
      </label>
      <label className="field-label">
        WhatsApp number
        <input
          autoComplete="tel"
          inputMode="tel"
          name="phone"
          placeholder="+91 98765 43210"
          required
          className="field-control"
        />
      </label>
      <p className="!mt-2 text-xs text-stone-500">
        We’ll only send updates about this visit and your orders.
      </p>
      <label className="field-label">
        How many in your party?
        <select name="partySize" defaultValue="2" className="field-control">
          {Array.from({ length: 20 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} {i === 0 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-3 rounded-2xl bg-[#f2f4ee] p-4 !font-normal leading-5 text-stone-600">
        <input type="checkbox" name="consent" required className="mt-1" />I
        agree to receive queue, order and payment updates on WhatsApp.
      </label>
      <Notice message={error} />
      <label className="flex gap-3">
        <input type="checkbox" name="priority" />
        Show paid fast-track options after joining (optional)
      </label>
      <button className="btn w-full !py-4" disabled={busy}>
        {busy ? "Saving your spot…" : "Get my queue number"}
      </button>
    </form>
  );
}
