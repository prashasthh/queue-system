"use client";
import { useState } from "react";
import { api, Badge, Loading, Notice, useData } from "../ui/common";
import type { Message } from "@/types";
import { time } from "@/lib/utils/format";
export function Messages() {
  const { data, error, refresh } = useData<Message[]>(
    "/api/admin/messages",
    5000,
  );
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="serif text-4xl">The message desk.</h1>
          <p className="mt-3 text-sm text-stone-500">
            Latest 100 notifications · Mock messages stay here and in server
            logs.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/admin/messages", {});
              await refresh();
            } catch (e) {
              setFailure((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Sending…" : "Retry pending messages"}
        </button>
      </div>
      <Notice message={error || failure} />
      {!data ? (
        <Loading error={error} />
      ) : !data.length ? (
        <div className="panel">
          No notifications yet. Join the queue to send the first one.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((m) => (
            <article key={m.id} className="panel">
              <div className="mb-4 flex items-center justify-between">
                <span className="eyebrow text-stone-500">
                  {m.provider} · {m.message_type.replaceAll("_", " ")}
                </span>
                <Badge status={m.status} />
              </div>
              <p className="whitespace-pre-line break-words text-sm leading-6">
                {m.message}
              </p>
              <p className="mt-5 text-xs text-stone-400">
                {time(m.created_at)} · {m.attempts} attempt(s)
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
