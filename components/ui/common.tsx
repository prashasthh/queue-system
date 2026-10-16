"use client";
import Link from "next/link";
import {
  UtensilsCrossed,
  ArrowUpRight,
  Check,
  CircleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
export async function api<T>(
  url: string,
  data?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(url, {
    method: method || (data ? "POST" : "GET"),
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong");
  return result;
}
export function useData<T>(url: string, poll = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(await api<T>(url));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load data");
    }
  }, [url]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const result = await api<T>(url);
        if (!stopped) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Could not load data");
      }
      if (!stopped && poll) timer = setTimeout(load, poll);
    };
    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [url, poll]);
  return { data, error, refresh };
}
export function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="restaurant-surface min-h-screen">
      <header className="border-b border-stone-200/80 bg-[#f7f3ec]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight"
          >
            <span className="rounded-xl bg-brand p-2 text-white">
              <UtensilsCrossed size={19} />
            </span>
            tableline<span className="text-brand">.</span>
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-600"
          >
            <span className="hidden sm:inline">Staff dashboard</span>
            <span className="sm:hidden">Staff</span> <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>
      <main
        className={`mx-auto px-5 py-8 sm:px-10 sm:py-12 ${wide ? "max-w-7xl" : "max-w-3xl"}`}
      >
        {children}
      </main>
      <footer className="mx-auto flex max-w-7xl justify-between gap-6 border-t border-stone-200 px-5 py-6 text-xs text-stone-500 sm:px-10">
        <span>A little less waiting. A lot more dining.</span>
        <span>Powered by tableline</span>
      </footer>
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  const color = ["paid", "completed", "seated", "sent"].includes(status)
    ? "bg-[#f4ebe5] text-[#5a382b]"
    : ["failed", "cancelled", "refunded"].includes(status)
      ? "bg-red-50 text-red-700"
      : ["called", "ready", "preparing"].includes(status)
        ? "bg-amber-50 text-amber-800"
        : "bg-stone-100 text-stone-600";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${color}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replaceAll("_", " ")}
    </span>
  );
}
export function Notice({
  message,
  success = false,
}: {
  message: string;
  success?: boolean;
}) {
  if (!message) return null;
  return (
    <div
      role={success ? "status" : "alert"}
      className={`my-4 flex items-start gap-2 rounded-xl p-4 text-sm ${success ? "bg-[#f4ebe5] text-[#5a382b]" : "bg-red-50 text-red-800"}`}
    >
      {success ? <Check size={18} /> : <CircleAlert size={18} />}
      <span>{message}</span>
    </div>
  );
}
export function Loading({ error }: { error?: string } = {}) {
  if (error)
    return (
      <button
        className="btn btn-secondary my-4"
        onClick={() => window.location.reload()}
      >
        Reload page
      </button>
    );
  return (
    <div role="status" className="panel my-6 text-stone-500">
      Loading your restaurant…
    </div>
  );
}
export function Steps({ active }: { active: number }) {
  return (
    <div className="mb-8 flex items-center overflow-x-auto rounded-full border border-stone-200 bg-white/70 p-1.5 text-xs text-stone-400 shadow-sm">
      {["Your visit", "Menu", "Review", "Payment"].map((s, i) => (
        <span
          key={s}
          className={`whitespace-nowrap rounded-full px-3 py-2 ${i === active ? "bg-ink font-bold text-white" : i < active ? "font-semibold text-[#79503e]" : ""}`}
        >
          <span className="mr-1">{i < active ? "✓" : i + 1}.</span> {s}
        </span>
      ))}
    </div>
  );
}
