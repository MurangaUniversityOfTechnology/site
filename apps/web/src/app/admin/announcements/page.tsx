"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, adminApi, type AdminAnnouncementRow, type AnnouncementState } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { AnnouncementView } from "@/components/AnnouncementCard";

type FormState = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  isActive: boolean;
  startsAt: string; // datetime-local value, "" = immediately
  endsAt: string; // datetime-local value, "" = until switched off
};

const EMPTY: FormState = { title: "", body: "", ctaLabel: "", ctaUrl: "", isActive: true, startsAt: "", endsAt: "" };

const STATE_STYLE: Record<AnnouncementState, string> = {
  live: "bg-accent/[0.12] text-navy",
  scheduled: "border border-accent-dim/50 text-accent-dim",
  ended: "border border-border-strong text-muted",
  off: "border border-border-strong text-muted",
};

// <input type="datetime-local"> wants local wall-clock "YYYY-MM-DDTHH:mm".
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function schedule(a: AdminAnnouncementRow) {
  if (a.starts_at && a.ends_at) return `${formatWhen(a.starts_at)} → ${formatWhen(a.ends_at)}`;
  if (a.starts_at) return `from ${formatWhen(a.starts_at)}`;
  if (a.ends_at) return `until ${formatWhen(a.ends_at)}`;
  return "no end date";
}

const inputClass =
  "mt-1.5 w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.12em] text-faint";

export default function AdminAnnouncementsPage() {
  const [rows, setRows] = useState<AdminAnnouncementRow[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const load = useCallback(() => {
    adminApi.listAnnouncements().then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function startEdit(a: AdminAnnouncementRow) {
    setEditingId(a.id);
    setError(null);
    setForm({
      title: a.title,
      body: a.body ?? "",
      ctaLabel: a.cta_label ?? "",
      ctaUrl: a.cta_url ?? "",
      isActive: a.is_active,
      startsAt: toLocalInput(a.starts_at),
      endsAt: toLocalInput(a.ends_at),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      body: form.body.trim() || null,
      cta_label: form.ctaLabel.trim() || null,
      cta_url: form.ctaUrl.trim() || null,
      is_active: form.isActive,
      starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    try {
      if (editingId) await adminApi.updateAnnouncement(editingId, payload);
      else await adminApi.createAnnouncement(payload);
      reset();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(a: AdminAnnouncementRow) {
    setError(null);
    try {
      await adminApi.updateAnnouncement(a.id, {
        title: a.title,
        body: a.body,
        cta_label: a.cta_label,
        cta_url: a.cta_url,
        is_active: !a.is_active,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the announcement.");
    }
  }

  async function remove(a: AdminAnnouncementRow) {
    const ok = await confirm({ title: "Delete announcement?", message: `"${a.title}" will stop showing and can't be restored.` });
    if (!ok) return;
    setError(null);
    try {
      await adminApi.deleteAnnouncement(a.id);
      if (editingId === a.id) reset();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete the announcement.");
    }
  }

  const hasHalfButton = !!form.ctaLabel.trim() !== !!form.ctaUrl.trim();

  return (
    <div className="max-w-220">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">programs</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Announcements</h1>
      <p className="mt-2.5 max-w-140 text-[14px] leading-[1.55] text-muted">
        A short notice that pops up for visitors, like a call for a designer or a new cohort opening. Each person sees
        it until they dismiss it, then never again. If several are live, the newest shows first.
      </p>

      <div className="mt-6.5 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <form onSubmit={save} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5.5">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            {editingId ? "editing" : "new announcement"}
          </div>

          <label className="block">
            <div className={labelClass}>Headline</div>
            <input
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              required
              maxLength={120}
              placeholder="We're looking for a graphic designer 🎨"
              className={inputClass}
            />
          </label>

          <label className="block">
            <div className={labelClass}>Message (optional)</div>
            <textarea
              value={form.body}
              onChange={(e) => patch({ body: e.target.value })}
              maxLength={400}
              rows={3}
              placeholder="Got an eye for layout and colour? Come design the club's posters and flyers."
              className={`${inputClass} resize-y`}
            />
            <div className="mt-1 text-right font-mono text-[10px] text-faint">{form.body.length}/400</div>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className={labelClass}>Button label</div>
              <input
                value={form.ctaLabel}
                onChange={(e) => patch({ ctaLabel: e.target.value })}
                maxLength={40}
                placeholder="Apply now"
                className={inputClass}
              />
            </label>
            <label className="block">
              <div className={labelClass}>Button link</div>
              <input
                value={form.ctaUrl}
                onChange={(e) => patch({ ctaUrl: e.target.value })}
                maxLength={500}
                placeholder="/forms/designer or https://…"
                className={inputClass}
              />
            </label>
          </div>
          {hasHalfButton && <p className="-mt-2 text-[12.5px] text-warn">A button needs both a label and a link.</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className={labelClass}>Show from (optional)</div>
              <input type="datetime-local" value={form.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <div className={labelClass}>Hide after (optional)</div>
              <input type="datetime-local" value={form.endsAt} onChange={(e) => patch({ endsAt: e.target.value })} className={inputClass} />
            </label>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={form.isActive} onChange={(e) => patch({ isActive: e.target.checked })} className="accent-[#ad8a45]" />
            <span className="text-[14px]">Active — visitors can see it (within the dates above)</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || hasHalfButton || !form.title.trim()}
              className="rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-navy hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "saving…" : editingId ? "save changes" : "publish"}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="text-[13px] text-muted hover:text-foreground">
                Cancel
              </button>
            )}
            {error && <span className="text-[13px] text-danger">{error}</span>}
          </div>
        </form>

        <div className="lg:sticky lg:top-6">
          <div className={labelClass}>Preview</div>
          <div className="mt-2">
            {form.title.trim() ? (
              <AnnouncementView
                announcement={{
                  title: form.title,
                  body: form.body.trim() || null,
                  cta_label: form.ctaLabel.trim() || null,
                  cta_url: form.ctaUrl.trim() || null,
                }}
                onDismiss={() => {}}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border-strong px-5 py-10 text-center text-[13px] text-faint">
                Start typing a headline to see how it looks.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">all announcements</div>
        {error && !saving && <p className="mt-2.5 text-sm text-danger">{error}</p>}
        {!rows ? (
          <p className="mt-4 text-sm text-faint">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing yet. Your first announcement will show up here.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {rows.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-surface px-4.5 py-3.5">
                <div className="min-w-48 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] ${STATE_STYLE[a.state]}`}>
                      {a.state}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-faint">{schedule(a)}</div>
                </div>
                <button onClick={() => toggle(a)} className="rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:text-foreground">
                  {a.is_active ? "turn off" : "turn on"}
                </button>
                <button onClick={() => startEdit(a)} className="rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:text-foreground">
                  edit
                </button>
                <button onClick={() => remove(a)} className="rounded-md border border-danger/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-danger hover:bg-danger/5">
                  delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
