"use client";

import { useState } from "react";
import type { EventAudience, EventWritePayload, ScheduleItem } from "@/lib/api";

export type EventFormValues = {
  slug: string;
  title: string;
  startsAtLocal: string;
  venue: string;
  description: string;
  audience: EventAudience;
  feeKes: string;
  capacity: string;
  whatYoullBuild: string;
  schedule: ScheduleItem[];
  speakerName: string;
  speakerMeta: string;
  requirements: string[];
  whoShouldAttend: string;
};

export const emptyEventForm: EventFormValues = {
  slug: "",
  title: "",
  startsAtLocal: "",
  venue: "",
  description: "",
  audience: "open_to_all",
  feeKes: "0",
  capacity: "",
  whatYoullBuild: "",
  schedule: [],
  speakerName: "",
  speakerMeta: "",
  requirements: [],
  whoShouldAttend: "",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function valuesToPayload(v: EventFormValues, localInputToIso: (s: string) => string): EventWritePayload {
  return {
    slug: v.slug.trim(),
    title: v.title.trim(),
    starts_at: localInputToIso(v.startsAtLocal),
    venue: v.venue.trim(),
    description: v.description.trim(),
    audience: v.audience,
    fee_kes: Number(v.feeKes) || 0,
    capacity: v.capacity.trim() ? Number(v.capacity) : null,
    what_youll_build: v.whatYoullBuild.trim() || null,
    schedule: v.schedule.filter((s) => s.time.trim() && s.what.trim()),
    speaker_name: v.speakerName.trim() || null,
    speaker_meta: v.speakerMeta.trim() || null,
    requirements: v.requirements.map((r) => r.trim()).filter(Boolean),
    who_should_attend: v.whoShouldAttend.trim() || null,
  };
}

export function EventForm({
  values,
  onChange,
  slugEditable,
}: {
  values: EventFormValues;
  onChange: (v: EventFormValues) => void;
  slugEditable: boolean;
}) {
  const [slugTouched, setSlugTouched] = useState(slugEditable === false);

  function setTitle(title: string) {
    onChange({ ...values, title, slug: slugTouched ? values.slug : slugify(title) });
  }

  function updateSchedule(i: number, key: keyof ScheduleItem, val: string) {
    const schedule = values.schedule.map((s, idx) => (idx === i ? { ...s, [key]: val } : s));
    onChange({ ...values, schedule });
  }

  function updateRequirement(i: number, val: string) {
    const requirements = values.requirements.map((r, idx) => (idx === i ? val : r));
    onChange({ ...values, requirements });
  }

  return (
    <div className="flex flex-col gap-4.5">
      <Field label="Title">
        <input
          required
          value={values.title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <Field label="Slug (used in the URL)">
        <input
          required
          value={values.slug}
          disabled={!slugEditable}
          onChange={(e) => {
            setSlugTouched(true);
            onChange({ ...values, slug: slugify(e.target.value) });
          }}
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent disabled:opacity-60"
        />
      </Field>
      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
        <Field label="Date & time (Africa/Nairobi)">
          <input
            required
            type="datetime-local"
            value={values.startsAtLocal}
            onChange={(e) => onChange({ ...values, startsAtLocal: e.target.value })}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Venue">
          <input
            required
            value={values.venue}
            onChange={(e) => onChange({ ...values, venue: e.target.value })}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>
      </div>
      <Field label="Short description">
        <textarea
          required
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">audience</div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(["open_to_all", "members_only"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ ...values, audience: a })}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                values.audience === a ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
              }`}
            >
              {a === "open_to_all" ? "Open to all" : "Members only"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
        <Field label="Fee (KSh, 0 = free)">
          <input
            type="number"
            min={0}
            value={values.feeKes}
            onChange={(e) => onChange({ ...values, feeKes: e.target.value })}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Capacity (blank = no cap)">
          <input
            type="number"
            min={0}
            value={values.capacity}
            onChange={(e) => onChange({ ...values, capacity: e.target.value })}
            placeholder="no cap"
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
        </Field>
      </div>

      <div className="mt-2 border-t border-border pt-4.5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">optional — full detail page</div>
      </div>

      <Field label="What you'll build">
        <textarea
          value={values.whatYoullBuild}
          onChange={(e) => onChange({ ...values, whatYoullBuild: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">schedule</div>
        <div className="mt-2.5 flex flex-col gap-2">
          {values.schedule.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={s.time}
                onChange={(e) => updateSchedule(i, "time", e.target.value)}
                placeholder="17:00"
                className="w-24 rounded-md border border-border-strong bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              />
              <input
                value={s.what}
                onChange={(e) => updateSchedule(i, "what", e.target.value)}
                placeholder="What happens at this time"
                className="flex-1 rounded-md border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => onChange({ ...values, schedule: values.schedule.filter((_, idx) => idx !== i) })}
                className="rounded-md border border-border-strong px-3 text-sm text-muted"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...values, schedule: [...values.schedule, { time: "", what: "" }] })}
            className="w-fit rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted"
          >
            + add slot
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
        <Field label="Speaker name">
          <input
            value={values.speakerName}
            onChange={(e) => onChange({ ...values, speakerName: e.target.value })}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Speaker meta (e.g. '4th year · club lead')">
          <input
            value={values.speakerMeta}
            onChange={(e) => onChange({ ...values, speakerMeta: e.target.value })}
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">requirements</div>
        <div className="mt-2.5 flex flex-col gap-2">
          {values.requirements.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={r}
                onChange={(e) => updateRequirement(i, e.target.value)}
                className="flex-1 rounded-md border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => onChange({ ...values, requirements: values.requirements.filter((_, idx) => idx !== i) })}
                className="rounded-md border border-border-strong px-3 text-sm text-muted"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...values, requirements: [...values.requirements, ""] })}
            className="w-fit rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted"
          >
            + add requirement
          </button>
        </div>
      </div>

      <Field label="Who should attend">
        <textarea
          value={values.whoShouldAttend}
          onChange={(e) => onChange({ ...values, whoShouldAttend: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="mt-2">{children}</div>
    </label>
  );
}
