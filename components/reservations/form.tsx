"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Notice } from "../ui/common";

function minutes(value: string) {
  const [hours, mins] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + mins;
}

function clock(value: number) {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function friendlyTime(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, 0, 1, hours, mins)));
}

export function ReservationForm({
  slug,
  openingTime,
  closingTime,
  occupancyMinutes,
  minDate,
  maxDate,
}: {
  slug: string;
  openingTime: string;
  closingTime: string;
  occupancyMinutes: number;
  minDate: string;
  maxDate: string;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [requestId] = useState(() => crypto.randomUUID());
  const bookingWindow = useMemo(() => {
    const opening = minutes(openingTime);
    const closing = minutes(closingTime);
    const serviceLength =
      closing > opening ? closing - opening : closing + 1440 - opening;
    return {
      opening,
      closing,
      overnight: closing <= opening,
      latest: clock(opening + serviceLength - occupancyMinutes),
    };
  }, [openingTime, closingTime, occupancyMinutes]);

  function validStart(value: FormDataEntryValue | null) {
    if (typeof value !== "string" || !value) return false;
    let selected = minutes(value);
    if (bookingWindow.overnight && selected < bookingWindow.opening)
      selected += 1440;
    const closing = bookingWindow.overnight
      ? bookingWindow.closing + 1440
      : bookingWindow.closing;
    return (
      selected >= bookingWindow.opening &&
      selected + occupancyMinutes <= closing
    );
  }

  return (
    <form
      className="panel space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        if (!validStart(f.get("time"))) {
          setError(
            `Choose a start time from ${friendlyTime(openingTime)} to ${friendlyTime(bookingWindow.latest)} so your table has the full ${occupancyMinutes} minutes before closing.`,
          );
          setBusy(false);
          return;
        }
        try {
          const row = await api<{ id: string }>("/api/reservations", {
            slug,
            requestId,
            name: f.get("name"),
            phone: f.get("phone"),
            partySize: Number(f.get("partySize")),
            startsAt: new Date(
              `${f.get("date")}T${f.get("time")}:00+05:30`,
            ).toISOString(),
            notes: f.get("notes"),
            consent: f.get("consent") === "on",
          });
          router.push(
            f.get("priority") === "on"
              ? `/priority/reservation/${row.id}`
              : `/reservation/${row.id}`,
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not book");
          setBusy(false);
        }
      }}
    >
      <label className="field-label">
        Your name
        <input
          name="name"
          className="field-control"
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label className="field-label">
        WhatsApp number
        <input
          name="phone"
          className="field-control"
          inputMode="tel"
          required
        />
      </label>
      <label className="field-label">
        Party size
        <input
          name="partySize"
          type="number"
          min={1}
          max={20}
          defaultValue={2}
          className="field-control"
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="field-label">
          Date
          <input
            name="date"
            type="date"
            min={minDate}
            max={maxDate}
            className="field-control"
            required
          />
        </label>
        <label className="field-label">
          Time (IST)
          <input
            name="time"
            type="time"
            min={bookingWindow.overnight ? undefined : openingTime}
            max={bookingWindow.overnight ? undefined : bookingWindow.latest}
            step={900}
            className="field-control"
            required
          />
        </label>
      </div>
      <div className="rounded-2xl border border-[#dfcfc2] bg-[#fbf6f1] px-4 py-3 text-sm leading-6 text-[#6f4b3b]">
        <strong className="text-[#3a261e]">Bookable start times:</strong>{" "}
        {friendlyTime(openingTime)}–{friendlyTime(bookingWindow.latest)} IST.
        This keeps the full {occupancyMinutes}-minute dining time before the
        restaurant closes at {friendlyTime(closingTime)}.
      </div>
      <label className="field-label">
        Special requests
        <textarea name="notes" maxLength={500} className="field-control" />
      </label>
      <label className="flex gap-3">
        <input name="consent" type="checkbox" required />I agree to WhatsApp
        updates about this reservation.
      </label>
      <label className="flex gap-3">
        <input type="checkbox" name="priority" />
        Review optional paid priority after booking
      </label>
      <Notice message={error} />
      <button className="btn w-full" disabled={busy}>
        {busy ? "Booking…" : "Book reservation"}
      </button>
    </form>
  );
}
