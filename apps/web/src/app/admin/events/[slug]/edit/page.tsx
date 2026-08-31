"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EventForm, valuesToPayload, type EventFormValues } from "@/components/EventForm";
import { ApiError, adminApi, type AdminEventRow } from "@/lib/api";
import { isoToLocalInput, localInputToIso } from "@/lib/eventFormat";

function toFormValues(e: AdminEventRow): EventFormValues {
  return {
    slug: e.slug,
    title: e.title,
    startsAtLocal: isoToLocalInput(e.starts_at),
    venue: e.venue,
    description: e.description,
    audience: e.audience,
    feeKes: String(e.fee_kes),
    capacity: e.capacity === null ? "" : String(e.capacity),
    whatYoullBuild: e.what_youll_build ?? "",
    schedule: e.schedule,
    speakerName: e.speaker_name ?? "",
    speakerMeta: e.speaker_meta ?? "",
    requirements: e.requirements,
    whoShouldAttend: e.who_should_attend ?? "",
  };
}

export default function EditEventPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [values, setValues] = useState<EventFormValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listEvents()
      .then((rows) => {
        const match = rows.find((r) => r.slug === params.slug);
        setValues(match ? toFormValues(match) : null);
      })
      .catch(() => setValues(null));
  }, [params.slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.updateEvent(params.slug, valuesToPayload(values, localInputToIso));
      router.push("/admin/events");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update event.");
    } finally {
      setBusy(false);
    }
  }

  if (values === null) return null;

  return (
    <div className="max-w-140">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">events</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Edit event</h1>

      <form onSubmit={submit} className="mt-6.5">
        <EventForm values={values} onChange={setValues} slugEditable={false} />
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-6.5 w-fit rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
