"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, adminApi, type ReminderSettings } from "@/lib/api";

const LEAD_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360];

function leadLabel(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

export default function ReminderSettingsPage() {
  const [form, setForm] = useState<ReminderSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.reminderSettings().then(setForm);
  }, []);

  function patch(p: Partial<ReminderSettings>) {
    setSaved(false);
    setForm((f) => (f ? { ...f, ...p } : f));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminApi.updateReminderSettings({
        day_before_enabled: form.day_before_enabled,
        day_before_time: form.day_before_time.slice(0, 5),
        hour_before_enabled: form.hour_before_enabled,
        hour_before_minutes: form.hour_before_minutes,
        include_pending: form.include_pending,
      });
      setForm(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the settings.");
    } finally {
      setSaving(false);
    }
  }

  const leadOptions = form && !LEAD_OPTIONS.includes(form.hour_before_minutes) ? [...LEAD_OPTIONS, form.hour_before_minutes].sort((a, b) => a - b) : LEAD_OPTIONS;

  return (
    <div className="max-w-180">
      <Link href="/admin/events" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-muted">
        ← events
      </Link>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Reminder emails</h1>
      <p className="mt-2.5 max-w-140 text-[14px] leading-[1.55] text-muted">
        Sent automatically to people registered for an upcoming event. These settings apply to every event. To email one
        event&apos;s registrants right now, use <strong className="font-medium text-foreground">Email registrants</strong>{" "}
        on that event&apos;s page.
      </p>

      {!form ? (
        <p className="mt-8 text-sm text-faint">Loading…</p>
      ) : (
        <form onSubmit={save} className="mt-7 flex flex-col gap-4">
          <div className="rounded-xl border border-accent-dim/40 bg-accent/[0.06] px-5 py-3.5 text-[14px]">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">currently · </span>
            {form.summary}
          </div>

          <Setting
            title="The evening before"
            description="Sent on the day before the event, at this time (Nairobi)."
            enabled={form.day_before_enabled}
            onToggle={(v) => patch({ day_before_enabled: v })}
          >
            <input
              type="time"
              value={form.day_before_time.slice(0, 5)}
              onChange={(e) => patch({ day_before_time: e.target.value })}
              disabled={!form.day_before_enabled}
              required
              aria-label="Evening reminder time"
              className="rounded-md border border-border-strong bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent disabled:opacity-50"
            />
          </Setting>

          <Setting
            title="Shortly before"
            description="Sent this long before the event starts. Arrives up to 5 minutes later than set."
            enabled={form.hour_before_enabled}
            onToggle={(v) => patch({ hour_before_enabled: v })}
          >
            <select
              value={form.hour_before_minutes}
              onChange={(e) => patch({ hour_before_minutes: Number(e.target.value) })}
              disabled={!form.hour_before_enabled}
              aria-label="How long before the event"
              className="rounded-md border border-border-strong bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent disabled:opacity-50"
            >
              {leadOptions.map((m) => (
                <option key={m} value={m}>
                  {leadLabel(m)} before
                </option>
              ))}
            </select>
          </Setting>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-5">
            <input
              type="checkbox"
              checked={form.include_pending}
              onChange={(e) => patch({ include_pending: e.target.checked })}
              className="mt-1 accent-[#ad8a45]"
            />
            <span>
              <span className="block text-[15px] font-medium">Also remind pending registrations</span>
              <span className="mt-1 block text-[13.5px] leading-[1.5] text-muted">
                Off by default, so only confirmed spots get reminders. Turn it on if approvals tend to lag behind the
                event. Pending people get a note that they&apos;re not confirmed yet, and no ticket link.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-navy hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "saving…" : "save settings"}
            </button>
            {saved && <span className="text-[13px] text-accent-dim">Saved ✓</span>}
            {error && <span className="text-[13px] text-danger">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function Setting({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-5">
      <label className="flex min-w-56 flex-1 cursor-pointer items-start gap-3">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="mt-1 accent-[#ad8a45]" />
        <span>
          <span className="block text-[15px] font-medium">{title}</span>
          <span className="mt-1 block text-[13.5px] leading-[1.5] text-muted">{description}</span>
        </span>
      </label>
      {children}
    </div>
  );
}
