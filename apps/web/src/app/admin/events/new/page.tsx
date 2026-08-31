"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EventForm, emptyEventForm, valuesToPayload, type EventFormValues } from "@/components/EventForm";
import { ApiError, adminApi } from "@/lib/api";
import { localInputToIso } from "@/lib/eventFormat";

export default function NewEventPage() {
  const router = useRouter();
  const [values, setValues] = useState<EventFormValues>(emptyEventForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await adminApi.createEvent(valuesToPayload(values, localInputToIso));
      router.push(`/admin/events/${created.slug}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-140">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">events</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">New event</h1>

      <form onSubmit={submit} className="mt-6.5">
        <EventForm values={values} onChange={setValues} slugEditable />
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-6.5 w-fit rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create event"}
        </button>
      </form>
    </div>
  );
}
